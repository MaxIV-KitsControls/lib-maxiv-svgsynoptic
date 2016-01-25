"""
A Taurus based TANGO backend for the SVG synoptic.
"""

import json

from PyQt4 import QtCore
import PyTango
from synopticwidget import SynopticWidget
from taurus import Attribute, Manager
from taurus.core.taurusbasetypes import (AttrQuality, DataFormat,
                                         TaurusEventType, TaurusSerializationMode)
from taurus.external.qt import Qt
from taurus.qt.qtgui.panel import TaurusDevicePanel, TaurusWidget
from taurus.qt.qtgui.application import TaurusApplication

from taurusregistry import Registry


class TooltipUpdater(QtCore.QThread):

    finished = QtCore.pyqtSignal(str, str)

    def __init__(self, model):
        QtCore.QThread.__init__(self)
        self.model = model

    def run(self):
        # TODO: This needs to be redone; maybe use string.template?
        try:
            attribute = Attribute(str(self.model) + "/State")
            if attribute:
                value = attribute.read()
                html = json.dumps('Value:&nbsp;' +
                                  '<span class="value">%s</span>'
                                  % value.value)
            self.finished.emit(self.model, html)
        except PyTango.DevFailed as e:
            print e


def getStateClasses(state=None):
    "Return a state CSS class configuration"
    return dict((("state-%s" % name), s == state)
                for name, s in PyTango.DevState.names.items())

# precalculate since this is done quite a lot
STATE_CLASSES = dict((state, json.dumps(getStateClasses(state)))
                     for name, state in PyTango.DevState.names.items())
STATE_CLASSES[None] = json.dumps(getStateClasses())


class TaurusSynopticWidget(SynopticWidget, TaurusWidget):

    """A SynopticWidget that connects to TANGO in order to
    get updates for models (attributes)."""

    tooltip_trigger = QtCore.pyqtSignal(str)

    def __init__(self, parent=None, **kwargs):
        super(TaurusSynopticWidget, self).__init__(parent=parent)
        Manager().setSerializationMode(TaurusSerializationMode.Concurrent)
        self.tooltip_trigger.connect(self._update_device_tooltip)
        self._panels = {}

    def setModel(self, image, section=None):
        print "setModel", image
        self.set_url(image)
        self.registry = Registry(self.attribute_listener,
                                 self.unsubscribe_listener)
        self.registry.start()
        self.js.plugin_command.connect(self.run_plugin_command)
        self.js.hovered.connect(self._hovered)
        # self._tooltip_data = {}
        # self.tooltip_registry = Registry(self._tooltip_updater)
        # self.tooltip_registry.start()

    def _hovered(self, sec, mods):
        print "hovered", sec, type(mods)
        attr = self.registry.get_listener(str(mods))
        print attr

    def getModel(self):
        return self._url

    def closeEvent(self, event):
        "Clean things up when the widget is closed"
        self.registry.clear()
        self.registry.stop()
        self.registry.wait()
        self.registry = None

    def run_plugin_command(self, plugin, cmd, args):
        try:
            plugins = __import__("plugins.%s" % plugin, globals(), locals(), [cmd], -1)
        except ImportError as e:
            print "Could not initialize plugin '%s'!" % plugin
            print e
            return ""
        return getattr(plugins, cmd)(self, args)

    def handle_subscriptions(self, models):
        print "handle_subscriptions", models
        if self.registry:
            self.registry.subscribe(models)

    def unsubscribe_listener(self, unsubscribed):
        """Tell the synoptic about unsubscribed models. This is
        needed because it's all asunchronous so it cannot be assumed
        that a model is really unsubscribed until it is."""
        classes = STATE_CLASSES[None]
        for model in unsubscribed:
            self.js.evaluate("synoptic.setClasses('model', %r, %s)" %
                             (model, classes))

    def attribute_listener(self, evt_src, evt_type, evt_value):
        "Handle events"
        if evt_type == TaurusEventType.Error:
            return  # handle errors somehow
        if evt_type == TaurusEventType.Config:
            return  # need to do something here too
        model = evt_src.getNormalName()
        value = evt_value.value
        if evt_value.data_format == DataFormat._0D:
            # we'll ignore spectrum/image attributes
            if isinstance(value, PyTango._PyTango.DevState):
                # classes = getStateClasses(value)
                classes = STATE_CLASSES[value]
                device, attr = model.rsplit("/", 1)
                self.js.evaluate("synoptic.setClasses('model', %r, %s)" %
                                 (device, classes))
                self.js.evaluate("synoptic.setClasses('model', '%s/State', %s)" %
                                 (device, classes))
            else:
                text = evt_src.displayValue(value)
                unit = evt_src.getConfig().unit
                if unit == "No unit":
                    unit = ""
                self.js.evaluate("synoptic.setText('model', %r, '%s %s')" %
                                 (model, text, unit))

    def on_click(self, kind, name):
        """The default behavior is to mark a clicked device and to zoom to a
        clicked section.  Override this function if you need something
        else.
        """
        print "on_click", kind, name
        if kind == "model" and self.registry.device_validator.isValid(name):
            self.select(kind, [name])
            self.emit(Qt.SIGNAL("graphicItemSelected(QString)"), name)
        elif kind == "section":
            self.zoom_to(kind, name)
        else:
            self.unselect_all()

    def get_device_panel(self, device):
        """Override to change which panel is opened for a given device
        name. Return a widget, or None if you're handling the panel
        yourself. TaurusDevicePanel is a good fallback.
        """
        w = TaurusDevicePanel()
        w.setModel(device)
        return w

    def on_rightclick(self, kind, name):
        "The default behavior for right clicking a device is to open a panel."
        if kind == "model" and self.registry.device_validator.isValid(name):
            if name in self._panels:
                widget = self._panels[name]
                if not widget.isVisible():
                    widget.show()
                widget.activateWindow()
                widget.raise_()
                return

            # check if we recognise the class of the device
            widget = self.get_device_panel(name)
            if not widget:
                return
            widget.closeEvent = lambda _: self._cleanup_panel(widget)
            self._panels[name] = widget
            widget.show()

    def _cleanup_panel(self, w):
        """In the long run it seems like a good idea to try and clean up
        closed panels. In particular, the Taurus polling thread can
        become pretty bogged down."""
        if self.registry:
            with self.registry.lock:
                print "cleaning up panel for", w.getModel(), "..."
                self._panels.pop(str(w.getModel()), None)
                w.setModel(None)
                print "done!"

    # Note: the tooltip stuff is broken and not currently in use.
    # Currently there is only the default tooltip which displays the
    # model name.

    def on_tooltip(self, models):
        # FIXME: looks like tooltip listeners aren't cleaned up until a new
        # tooltip is displayed. This seems wasteful.
        if models:
            all_models = []
            for model in models:
                if self.registry.device_validator.isValid(model):
                    all_models.append(model + "/State")
                    all_models.append(model + "/Status")
                else:
                    all_models.append(model)
            self.tooltip_registry.subscribe(all_models)
            self._tooltip_data = dict((str(model), {}) for model in models)
        else:
            self.tooltip_registry.subscribe()
            self._tooltip_data.clear()

    def _tooltip_updater(self, model, attr_value):
        value = attr_value.value
        device, attr = model.rsplit("/", 1)
        if attr in ("State", "Status"):
            if attr == "Status":
                # hack to keep newlines
                value = value.replace("\n", "<br>")
            self._tooltip_data.setdefault(device, {})[attr] = value
            #dev = evt_src.getParentObj()
            #info = dev.getHWObj().info()
            # self._tooltip_data[device]["Class"] = info.dev_class
            self.tooltip_trigger.emit(device)
        else:
            self._tooltip_data[model] = value

    def _update_device_tooltip(self, device):
        # TODO: redo this in a neat way.
        data = {"Class": "...", "State": "...", "Status": "..."}
        data.update(self._tooltip_data[device])
        html = json.dumps(
            ('<div>Class:&nbsp;<span>{Class}</span></div>' +
             '<div>State:&nbsp;<span class="{State}">{State}</span></div>' +
             '<div>Status:&nbsp;<span>{Status}</span></div>').format(**data))
        self.js.evaluate('synoptic.setTooltipHTML("%s", %s)' %
                         (device, html))

    def closeEvent(self, event):
        # Get rid of all opened panels, otherwise the application will
        # not exit cleanly.
        super(TaurusSynopticWidget, self).closeEvent(event)
        for model, panel in self._panels.items():
            print "closing panel for", model
            panel.close()


if __name__ == '__main__':
    import sys
    print sys.argv[1]
    # qapp = Qt.QApplication([])
    app = TaurusApplication()
    sw = TaurusSynopticWidget()
    app.focusChanged.connect(sw.onFocus)
    sw.setModel(sys.argv[1])
    sw.show()
    app.exec_()
