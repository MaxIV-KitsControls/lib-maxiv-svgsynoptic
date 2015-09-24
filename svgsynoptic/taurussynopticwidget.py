import json

from PyQt4 import QtCore
import PyTango
from synopticwidget import SynopticWidget
from taurus import Manager, Attribute
from taurus.core.taurusbasetypes import TaurusSerializationMode
from taurus.external.qt import Qt
from taurus.qt.qtgui.panel import TaurusWidget, TaurusDevicePanel
from taurus.core.taurusbasetypes import AttrQuality, TaurusEventType, DataFormat

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

def getStateClasses(state):
    "Return a state CSS class configuration"
    return dict((("state-%s" % name), s == state)
                for name, s in PyTango.DevState.names.items())


class TaurusSynopticWidget(SynopticWidget, TaurusWidget):

    """A SynopticWidget that connects to Tango in order to
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
        self.registry = Registry(self.attribute_listener)
        self.registry.start()

        # self._tooltip_data = {}
        # self.tooltip_registry = Registry(self._tooltip_updater)
        # self.tooltip_registry.start()

    def getModel(self):
        return self._url

    def closeEvent(self, event):
        "Clean things up when the difget is"
        self.registry.clear()
        self.registry.stop()
        self.registry.wait()
        self.registry = None

    def handle_subscriptions(self, models):
        print "handle_subscriptions", models
        if self.registry:
            self.registry.subscribe(models)

    def __attribute_listener(self, event):
        # TODO: seems like multiline strings may need more escaping, else
        # evaljs complains about "SyntaxError: Expected token ')'"
        self.js.evaluate("synoptic.handleEvent(%r)" % json.dumps(event))

    def attribute_listener(self, evt_src, evt_type, evt_value):
        if evt_type == TaurusEventType.Error:
            return  # handle errors somehow
        if evt_type == TaurusEventType.Config:
            return  # need to do something here too
        model = evt_src.getNormalName()
        value = evt_value.value
        if evt_value.data_format == DataFormat._0D:
            # we'll ignore spectrum/image attributes
            if isinstance(value, PyTango._PyTango.DevState):
                classes = getStateClasses(value)
                device, attr = model.rsplit("/", 1)
                self.js.evaluate("synoptic.setClasses('model', %r, %s)" %
                                 (device, json.dumps(classes)))
                self.js.evaluate("synoptic.setClasses('model', '%s/State', %s)" %
                                 (device, json.dumps(classes)))
            else:
                text = evt_src.displayValue(value)
                self.js.evaluate("synoptic.setText('model', %r, %r)" % (model, text))

    def ___attribute_listener(self, model, attr, attr_value):
        value = attr_value.value
        if isinstance(value, PyTango._PyTango.DevState):
            classes = getStateClasses(value)
            device, attr = model.rsplit("/", 1)
            self.js.evaluate("synoptic.setClasses('model', %r, %s)" %
                             (device, json.dumps(classes)))
            self.js.evaluate("synoptic.setClasses('model', '%s/State', %s)" %
                             (device, json.dumps(classes)))
        else:
            config = self.registry.get_config(model)
            if config:
                text = config.format % value
            else:
                text = str(value)
            self.js.evaluate("synoptic.setText('model', %r, %r)" % (model, value))

    def on_click(self, kind, name):
        """The default behavior is to mark a clicked device and to zoom to a
        clicked section.  Override this function if you need something
        else.
        """
        print "on_click", kind, name
        if kind == "model":
            self.select(kind, [name])
            self.emit(Qt.SIGNAL("graphicItemSelected(QString)"), name)
        elif kind == "section":
            self.zoom_to(kind, name)

    def get_device_panel(self, device):
        """Override to change which panel is opened for a given
        device name. Return a widget class, or None if you're
        handling the panel yourself"""
        return TaurusDevicePanel

    def on_rightclick(self, kind, name):
        """We'll try to open a generic Taurus panel for a clicked
        device. Override this for more custom behavior!"""
        if kind == "model" and self.registry.device_validator.isValid(name):
            if name in self._panels:
                widget = self._panels[name]
                if not widget.isVisible():
                    widget.show()
                widget.activateWindow()
                widget.raise_()
                return

            # check if we recognise the class of the device
            panel_class = self.get_device_panel(name)
            if not panel_class:
                return
            widget = panel_class()
            widget.setModel(name)
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

    # def __on_tooltip(self, model):
    #     if hasattr(self, "_updater") and self._updater.isRunning():
    #         self._updater.stop()
    #     self._updater = TooltipUpdater(model)
    #     self._updater.finished.connect(self._on_tooltip)
    #     self._updater.start()

    # def _on_tooltip(self, model, html):
    #     self.js.evaluate('synoptic.setTooltipHTML("%s", %s)' % (model, html))

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
    qapp = Qt.QApplication([])
    sw = TaurusSynopticWidget()
    sw.setModel(sys.argv[1])
    sw.show()
    qapp.exec_()
