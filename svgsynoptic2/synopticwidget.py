"""
A Qt widget that displays a SVG based synoptic view.
It allows navigation in the form of zooming, panning and clicking
various areas to zoom in.
"""

import logging
import os
import json

from PyQt5 import Qt, QtCore, QtWidgets
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtWebEngineWidgets import QWebEnginePage, QWebEngineView

from .jsinterface import JSInterface


class LoggingWebPage(QWebEnginePage):
    """
    Use a Python logger to print javascript console messages.
    Very useful for debugging javascript...
    """
    def __init__(self, logger=None, parent=None):
        super(LoggingWebPage, self).__init__(parent)
        if not logger:
            logger = logging
        self.logger = logger

    def javaScriptConsoleMessage(self, source_id, msg, line_number, filename):
        # don't use the logger for now; too verbose :)
        print(f"JsConsole({source_id}:{line_number}):\n\t{msg}\n\t{filename}")


class SynopticWidget(QtWidgets.QWidget):

    """
    A Qt widget displaying a SVG synoptic in a webview.

    This widget does not have a "backend", so it's intended
    to be subclassed to add control system specific behavior.
    See TaurusSynopticWidget for a TANGO implementation.
    """

    subscribe = QtCore.pyqtSignal(str)

    def __init__(self, url=None, parent=None, *args, **kwargs):
        super(SynopticWidget, self).__init__(parent)
        self.subscribe.connect(self._handle_subscriptions)
        self._url = url
        self._setup_ui(url)
        self._modelNames = None

    def _setup_ui(self, url=None, section=None):
        self.hbox = hbox = QtWidgets.QHBoxLayout(self)
        self.hbox.setContentsMargins(0, 0, 0, 0)
        self.hbox.layout().setContentsMargins(0, 0, 0, 0)
        self.setLayout(self.hbox)
        if url:
            self.set_url(url, section)

    def set_url(self, url, section=None):
        # TODO: probably breaks things if the url is already set
        self._url = url
        self.splitter = QtWidgets.QSplitter(self)
        self.splitter.setOrientation(QtCore.Qt.Vertical)
        self.hbox.addWidget(self.splitter)
        view = self._create_view(url, section)
        self.splitter.addWidget(view)

    def setConfig(self, config_file):
        abspath = os.path.dirname(os.path.abspath(config_file))
        # build a javascript defining the models
        text = "var modelNames ={"
        with open(config_file, 'r') as read_file:
            data = json.load(read_file)
            for key in data.keys():
                text += key + " : \"" + data[key] + "\","
        text += "};"
        self._modelNames = text

    def _create_view(self, html=None, section=None):
        """
        Create the webview that will display the synoptic itself
        """
        view = QWebEngineView(self)
        channel = QWebChannel(self)
        # This is supposedly an optimisation. Disable if there are
        # graphical artifacts or something.
        view.settings().TiledBackingStoreEnabled = True

        page = LoggingWebPage()
        view.setPage(page)
        view.setContextMenuPolicy(QtCore.Qt.PreventContextMenu)

        # setup the JS interface
        frame = view.page()
        self.js = JSInterface(frame)
        self.js.subscription.connect(self.subscribe)
        channel.registerObject('QtBackend', self.js)
        frame.setWebChannel(channel)

        # mouse interaction signals
        self.clicked = self.js.leftclicked
        self.rightClicked = self.js.rightclicked
        self.hovered = self.js.hovered
        self.clicked.connect(self._on_click)
        self.rightClicked.connect(self._on_rightclick)
        self.hovered.connect(self._on_hover)

        # load the page
        # need to set the "base URL" for the webview to find the
        # resources (js, css).
        base_url = QtCore.QUrl().fromLocalFile(
            os.path.abspath(os.path.dirname(__file__)) + "/web/")

        # some ugly magic to get the path to the SVG file right. It
        # needs to be absolute because local paths go to the base URL.
        abspath = os.path.dirname(os.path.abspath(html))

        with open(html) as f:
            text = f.read().replace("${path}", abspath)  # TODO: use template
            if self._modelNames is not None:
                if "/*configplaceholder*/" in text:
                    texta, textb = text.split("/*configplaceholder*/", 1)
                    text = texta + self._modelNames + textb
            view.setHtml(text, base_url)

        return view

    def _handle_subscriptions(self, models):
        # we get the subscribed models as a comma separated list from Qt,
        # let's deliver something neater.
        if models:
            self.handle_subscriptions(str(models).split("\n"))
        else:
            self.handle_subscriptions([])

    def handle_subscriptions(self, models):
        # This noop needs to be overridden in order for subscriptions
        # to actually do anything!
        # "models" is a list of models that are currently visible
        # in the synoptic.
        pass

    def _on_click(self, kind, name):
        # this is a workaround for a strange behavior; under some circumstances
        # we get QStrings here, and sometimes unicode. Investigate!
        self.on_click(str(kind), str(name))

    def on_click(self, kind, name):
        """
        Default behavior on click. Override to change!
        """
        if kind == "section":
            self.zoom_to(kind, name)
        elif kind == "model":
            self.select(kind, [name])

    def _on_rightclick(self, kind, name):
        # see _on_click()
        self.on_rightclick(str(kind), str(name))

    def on_rightclick(self, kind, name):
        """
        Placeholder; override me!
        """
        pass

    def _on_hover(self, section, models):
        # we get a comma separated string of concatenated models here.
        splitmodels = str(models).split("\n") if models else []
        self.on_hover(section, splitmodels)

    def on_hover(self, section, models):
        """
        Show a basic 'tooltip' when the mouse pointer is over an item.
        """
        # Override this to add more interesting behavior
        if section:
            self.js.evaluate("synoptic.showTooltip();")
            self.js.evaluate("synoptic.setTooltipHTML('%s')" % section)
        elif models:
            self.js.evaluate("synoptic.showTooltip();")
            self.js.evaluate("synoptic.setTooltipHTML('%s')" % models[0])
        else:
            self.js.evaluate("synoptic.hideTooltip();")

    # # # 'Public' API # # #

    def zoom_to(self, kind, name):
        """
        Move the view so that the given object is visible
        """
        self.js.evaluate("synoptic.zoomTo(%r, %r)" % (str(kind), str(name)))

    def select(self, kind, names, replace=True):
        """
        Set a list of items as 'selected'. By default unselects all
        previously selected things first.
        """
        if replace:
            self.js.evaluate("synoptic.unselectAll()")
        if names:
            for name in names:
                self.js.evaluate("synoptic.select(%r, %r)" %
                                 (str(kind), [str(name)]))

    def unselect_all(self):
        self.js.evaluate("synoptic.unselectAll();")
    # def send_debug_message(self, msg):
    #     self.js.evaluate("Tango.debugMessage(%r)" % msg)


if __name__ == '__main__':
    import sys
    qapp = Qt.QApplication([])
    sw = SynopticWidget(sys.argv[1])
    sw.show()
    qapp.exec_()
