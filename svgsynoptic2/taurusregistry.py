from threading import Lock, Event
from time import sleep

from PyQt4 import QtCore
from taurus import Attribute
from taurus.core import TaurusException
try:
    from taurus.core.tango.tangovalidator import (TangoAttributeNameValidator,
                                                  TangoDeviceNameValidator)
    from taurus.core.evaluation.evalvalidator import (
        EvaluationAttributeNameValidator)
except ImportError:
    from taurus.core.taurusvalidator import (
        AttributeNameValidator as TangoAttributeNameValidator,
        DeviceNameValidator as TangoDeviceNameValidator)
    from taurus.core.evaluation import EvaluationAttributeNameValidator
import PyTango

# We can't use pytango's CaselessDict since it does not keep the original
# case of the keys :(
from caseless import CaselessDictionary as CaselessDict

from ttldict import TTLDict


class Registry(QtCore.QThread):

    """
    A thread that handles attribute subscriptions.

    The main purpose of this thread is to offload the setting up and
    tearing down of subscriptions from the main UI thread, to make the
    operation "asynchronous". We don't want the UI to lock up briefly
    every time we do this (which may be very often in the case of a
    large, zoomable synoptic).
    """

    def __init__(self, event_callback, unsubscribe_callback, period=0.5):
        QtCore.QThread.__init__(self)
        self.listeners = CaselessDict()
        self.inverse_listeners = {}
        self.event_callback = event_callback
        self.unsubscribe_callback = unsubscribe_callback
        self.period = period
        self._attributes = None
        self._taurus_attributes = CaselessDict()
        self._config = CaselessDict()
        self._last_event = TTLDict(default_ttl=10)
        self.attribute_validator = TangoAttributeNameValidator()
        self.device_validator = TangoDeviceNameValidator()
        self.eval_validator = EvaluationAttributeNameValidator()
        self.lock = Lock()
        self.stopped = Event()

    def run(self):
        "A simple loop checking for changes to the attribute list"
        # "batching" the updates should be more efficient than
        # reacting immediately, especially when listeners can come and
        # go quite frequently.
        while not self.stopped.is_set():
            sleep(self.period)
            if self._attributes is not None:
                attributes, self._attributes = self._attributes, None
                with self.lock:
                    self._update(attributes)

    def subscribe(self, models=[]):
        """Set the currently subscribed list of models."""
        attrs = CaselessDict()
        taurusattrs = self._taurus_attributes
        for model in models:
            if self.device_validator.isValid(model):
                # for convenience, we subscribe to State for any devices
                modelstate = model + "/State"
                attrs[modelstate] = True
                if modelstate not in taurusattrs.keys():
                    try:
                        taurusattrs[modelstate] = Attribute(modelstate)
                    except TaurusException as e:
                        print "Failed to create Taurus Attribute for model %s! %s" % (model, e)
                    except PyTango.DevFailed as e:
                        print "Failed to create Taurus Attribute for model %s! %s" % (model, e)
            elif (self.attribute_validator.isValid(model) or
                    self.eval_validator.isValid(model)):
                attrs[model] = True
                if model not in taurusattrs.keys():
                    try:
                        taurusattrs[model] = Attribute(model)
                    except TaurusException as e:
                        print "Failed to create Taurus Attribute for model %s! %s" % (model, e)
                    except Exception as e:
                        print "Failed to create Taurus Attribute for model %s!" % (model)
            else:
                print "Invalid Taurus model %s!?" % model
        self._attributes = attrs
        self._taurus_attributes = taurusattrs

    def get_value(self, model):
        evt = self._last_event.get(model)
        if evt:
            return evt.attr_value

    def get_config(self, model):
        return self._config.get(model)

    def handle_event(self, evt_src, *args):
        # lookup the model(s) for this listener and notify them
        models = self.inverse_listeners.get(evt_src, [])
        for model in models:
            self.event_callback(model, evt_src, *args)

    def _update(self, attributes=CaselessDict()):

        "Update the subscriptions; add new ones, remove old ones"

        listeners = set(k.lower() for k in self.listeners.keys())
        new_attrs = set(attributes) - set(listeners)
        old_attrs = set(listeners) - set(attributes)

        for attr in old_attrs:
            if self._attributes:
                # meaning we got a new list of subscriptions, so
                # no point in continuing with this one.
                return
            self._remove_listener(attr)
            self._last_event.pop(attr, None)

        for attr in new_attrs:
            if self._attributes:
                return
            try:
                self._add_listener(attr)
            except (TypeError, PyTango.DevFailed) as e:
                print "Failed to setup listener for", attr, e

        self.unsubscribe_callback(old_attrs)

    def _add_listener(self, model):
        try:
            listener = self.listeners[model] = self._taurus_attributes[model]
            # to make loopkups more efficient, we also keep an "inverted"
            # mapping of listeners->models. But since some models may map
            # to the *same* listener (e.g. eval expressions), this must
            # be a one-to-many map.
            if listener in self.inverse_listeners:
                self.inverse_listeners[listener][model] = True
            else:
                self.inverse_listeners[listener] = CaselessDict([(model, True)])
            listener.addListener(self.handle_event)
            return listener
        except (TaurusException, AttributeError) as e:
            print "Failed to subscribe to model %s! %s" % (model, e)
        except Exception:
            print "Failed to subscribe to model %s!" % (model)

    def _remove_listener(self, model):
        listener = self.listeners.pop(model)
        models = self.inverse_listeners[listener]
        models.pop(model)
        if not models:
            self.inverse_listeners.pop(listener)
        listener.removeListener(self.handle_event)

    def get_listener(self, model):
        "return the listener for a given model"
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
