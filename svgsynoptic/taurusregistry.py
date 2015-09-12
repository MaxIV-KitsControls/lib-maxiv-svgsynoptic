from threading import Lock, Event
import time

from PyQt4 import QtCore
from taurus import Attribute
from taurus.core.taurusvalidator import (AttributeNameValidator,
                                         DeviceNameValidator)
import PyTango


class Registry(QtCore.QThread):

    """A thread that handles setting up and tearing down attribute listeners"""

    lock = Lock()

    def __init__(self, callback):
        QtCore.QThread.__init__(self)
        self.listeners = {}
        self.callback = callback
        self._attributes = None
        self.attribute_validator = AttributeNameValidator()
        self.device_validator = DeviceNameValidator()
        self.lock = Lock()
        self.stopped = Event()

    def run(self):
        "A simple loop checking for changes to the attribute list"
        while not self.stopped.is_set():
            time.sleep(0.5)
            if self._attributes:
                attributes, self._attributes = self._attributes, None
                with self.lock:
                    self.update(attributes)

    def subscribe(self, models=[]):
        attrs = set()
        for model in models:
            if self.attribute_validator.isValid(model):
                attrs.add(model)
            elif self.device_validator.isValid(model):
                attrs.add(model + "/State")
            else:
                print ("Invalid model %s; must be Tango device or attribute!" %
                       model)
        self._attributes = attrs

    def update(self, attributes=set()):

        "Update the subscriptions"

        listeners = set(self.listeners.keys())
        new_attrs = attributes - listeners
        old_attrs = listeners - attributes

        for attr in old_attrs:
            self.listeners.pop(attr).removeListener(self.callback)

        for attr in new_attrs:
            try:
                tattr = self.listeners[attr] = Attribute(attr)
                tattr.addListener(self.callback)
            except PyTango.DevFailed:
                pass  # Do something?

    def stop(self):
        self.stopped.set()

    def clear(self):
        self._attributes = None
        self.update()
