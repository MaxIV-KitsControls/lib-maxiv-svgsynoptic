from threading import Lock, Event
import time

from PyQt4 import QtCore
from taurus import Attribute
from taurus.core.taurusvalidator import (AttributeNameValidator,
                                         DeviceNameValidator)
from taurus.core.taurusbasetypes import AttrQuality, TaurusEventType, DataFormat
import PyTango

from ttldict import TTLDict


class Registry(QtCore.QThread):

    """A thread that handles setting up and tearing down attribute listeners"""

    lock = Lock()

    def __init__(self, event_callback, unsubscribe_callback):
        QtCore.QThread.__init__(self)
        self.listeners = {}
        self.event_callback = event_callback
        self.unsubscribe_callback = unsubscribe_callback
        self._attributes = set()
        self._config = {}
        self._last_event = TTLDict(default_ttl=10)
        self.attribute_validator = AttributeNameValidator()
        self.device_validator = DeviceNameValidator()
        self.lock = Lock()
        self.stopped = Event()

    def run(self):
        "A simple loop checking for changes to the attribute list"
        while not self.stopped.is_set():
            time.sleep(0.5)
            if self._attributes:
                attributes, self._attributes = self._attributes, set()
                with self.lock:
                    self._update(attributes)

    def subscribe(self, models=[]):
        attrs = set()
        for model in models:
            if self.attribute_validator.isValid(model):
                attrs.add(model)
            elif self.device_validator.isValid(model):
                attrs.add(model + "/State")
            else:
                raise ValueError(
                    "Invalid model %s; must be Tango device or attribute!" %
                    model)
        self._attributes = attrs

    def get_value(self, model):
        evt = self._last_event.get(model)
        if evt:
            return evt.attr_value

    def get_config(self, model):
        return self._config.get(model)

    def handleEvent(self, evt_src, evt_type, evt_value):
        if evt_type in (PyTango.EventType.CHANGE_EVENT,
                        PyTango.EventType.PERIODIC_EVENT):
            model = evt_src.getNormalName()
            if model in self.listeners:
                if model in self._last_event:
                    last_event = self._last_event[model]
                    if (evt_value.value != last_event.value and
                        evt_value.quality != last_event.quality):
                        self.event_callback(model, evt_value)
                else:
                    self.event_callback(model, evt_value)
                self._last_event[model] = evt_value
            else:
                listener = self.listeners.pop(model)
                listener.removeListener(self.handleEvent)
        elif evt_type == TaurusEventType.Config:
            model = evt_src.getNormalName().split("?")[0]

            self._config[model] = evt_value
        # TODO: Config events, errors..?

    def _update(self, attributes=set()):

        "Update the subscriptions"

        listeners = set(self.listeners.keys())
        new_attrs = attributes - listeners
        old_attrs = listeners - attributes

        for attr in old_attrs:
            if self._attributes:
                # meaning we got a new list of subscriptions, so
                # no point in continuing with this one.
                return
            self.listeners.pop(attr).removeListener(self.event_callback)
            self._last_event.pop(attr, None)

        for attr in new_attrs:
            if self._attributes:
                return
            try:
                tattr = self.listeners[attr] = Attribute(attr)
                tattr.addListener(self.event_callback)
            except PyTango.DevFailed as e:
                print "Failed to setup listener for", attr, e

        self.unsubscribe_callback(old_attrs)

    def get_listener(self, model):
        if model in self.listeners:
            return self.listeners[model]
        for attr in self.listeners.values():
            if attr.getNormalName().lower() == model.lower():
                return attr

    def stop(self):
        self.stopped.set()

    def clear(self):
        self._attributes.clear()
        self._last_event.clear()
        self._update()
