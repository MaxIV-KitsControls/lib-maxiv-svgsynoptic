from threading import Lock, Event
import time

from PyQt4 import QtCore
from taurus import Attribute
from taurus.core.taurusvalidator import AttributeNameValidator
import PyTango


class Registry(QtCore.QThread):

    """A thread that handles setting up and tearing down attribute listeners"""

    lock = Lock()

    def __init__(self, callback):
        QtCore.QThread.__init__(self)
        self.listeners = {}
        self.callback = callback
        self._attributes = None
        self.attribute_name_validator = AttributeNameValidator()
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

    def subscribe(self, attributes):
        self._attributes = attributes

    def update(self, attributes):

        "Update the subscriptions"

        attrs = set()
        invalid_attrs = set()

        for attr in attributes:
            if self.attribute_name_validator.isValid(attr):
                attrs.add(attr)
            else:
                invalid_attrs.add(attr)
        if invalid_attrs:
            # TODO: logging
            print "Got invalid atttributes: %s" % ",".join(invalid_attrs)

        listeners = set(self.listeners.keys())

        new_attrs = attrs - listeners
        old_attrs = listeners - attrs

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
        self.update([])
