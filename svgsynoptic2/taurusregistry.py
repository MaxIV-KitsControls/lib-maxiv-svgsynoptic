from threading import Lock, Event
from time import sleep

from PyQt4 import QtCore
from taurus import Attribute
try:
    from taurus.core.tango.tangovalidator import (TangoAttributeNameValidator,
                                                  TangoDeviceNameValidator)
    from taurus.core.evaluation.evalvalidator import EvaluationAttributeNameValidator
except ImportError:
    from taurus.core.taurusvalidator import (AttributeNameValidator as TangoAttributeNameValidator,
                                             DeviceNameValidator as TangoDeviceNameValidator)
    from taurus.core.evaluation import EvaluationAttributeNameValidator
from taurus.core.taurusbasetypes import AttrQuality, TaurusEventType, DataFormat
import PyTango

from ttldict import TTLDict


class Registry(QtCore.QThread):

    """A thread that handles setting up and tearing down attribute listeners"""

    lock = Lock()

    def __init__(self, event_callback, unsubscribe_callback, period=0.5):
        QtCore.QThread.__init__(self)
        self.listeners = {}
        self.inverse_listeners = {}
        self.event_callback = event_callback
        self.unsubscribe_callback = unsubscribe_callback
        self.period = period
        self._attributes = set()
        self._config = {}
        self._last_event = TTLDict(default_ttl=10)
        self.attribute_validator = TangoAttributeNameValidator()
        self.device_validator = TangoDeviceNameValidator()
        self.eval_validator = EvaluationAttributeNameValidator()
        self.lock = Lock()
        self.stopped = Event()

    def run(self):
        "A simple loop checking for changes to the attribute list"
        while not self.stopped.is_set():
            sleep(self.period)
            if self._attributes:
                attributes, self._attributes = self._attributes, set()
                with self.lock:
                    self._update(attributes)

    def subscribe(self, models=[]):
        attrs = set()
        for model in models:
            if (self.attribute_validator.isValid(model) or
                    self.eval_validator.isValid(model)):
                attrs.add(model)
            elif self.device_validator.isValid(model):
                attrs.add(model + "/State")
            else:
                print "Invalid model %s; must be Tango device or attribute!" % model
        self._attributes = attrs

    def get_value(self, model):
        evt = self._last_event.get(model)
        if evt:
            return evt.attr_value

    def get_config(self, model):
        return self._config.get(model)

    def handle_event(self, evt_src, *args):
        model = self.inverse_listeners.get(evt_src)
        if model:
            self.event_callback(model, evt_src, *args)

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
            self.remove_listener(attr)
            self._last_event.pop(attr, None)

        for attr in new_attrs:
            if self._attributes:
                return
            try:
                self.add_listener(attr)
            except PyTango.DevFailed as e:
                print "Failed to setup listener for", attr, e

        self.unsubscribe_callback(old_attrs)

    def add_listener(self, model):
        listener = self.listeners[model] = Attribute(model)
        self.inverse_listeners[listener] = model
        listener.addListener(self.handle_event)
        return listener

    def remove_listener(self, model):
        listener = self.listeners.pop(model)
        self.inverse_listeners.pop(listener)
        listener.removeListener(self.handle_event)

    def _make_callback(self, model):
        def callback(*args):
            self.event_callback(model, *args)
        self._callbacks[model] = callback
        return callback

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
