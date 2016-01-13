"""
A Qt widget that displays a SVG based synoptic view.
It allows navigation in the form of zooming, panning and clicking
various areas to zoom in.
"""

import logging
import os

from PyQt4 import Qt, QtCore, QtGui
from PyQt4.QtWebKit import QWebPage, QWebView

from jsinterface import JSInterface


class LoggingWebPage(QWebPage):
    """
    Use a Python logger to print javascript console messages.
    Very useful for debugging javascript...
    """
    def __init__(self, logger=None, parent=None):
        super(LoggingWebPage, self).__init__(parent)
        if not logger:
            logger = logging
        self.logger = logger

    def javaScriptConsoleMessage(self, msg, lineNumber, sourceID):
        # don't use the logger for now; too verbose :)
        print "JsConsole(%s:%d):\n\t%s" % (sourceID, lineNumber, msg)


class SynopticWidget(QtGui.QWidget):

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

    def _setup_ui(self, url=None, section=None):
        self.hbox = hbox = QtGui.QHBoxLayout(self)
        hbox.setContentsMargins(0, 0, 0, 0)
        hbox.layout().setContentsMargins(0, 0, 0, 0)
        if url:
            hbox.addWidget(self._create_view(url, section))

        self.setLayout(hbox)

    def set_url(self, url):
        # TODO: probably breaks things if the url is already set
        self._url = url
        print "set_url", url
        self.hbox.addWidget(self._create_view(url))

    def _create_view(self, html=None, section=None):
        "Create the webview that will display the synoptic itself"
        view = QWebView(self)

        # This is supposedly an optimisation. Disable if there are
        # graphical artifacts or something.
        view.settings().TiledBackingStoreEnabled = True
        view.setRenderHint(QtGui.QPainter.TextAntialiasing, False)

        page = LoggingWebPage()
        view.setPage(page)
        view.setContextMenuPolicy(QtCore.Qt.PreventContextMenu)

        # setup the JS interface
        frame = view.page().mainFrame()
        self.js = JSInterface(frame)
        self.js.subscription.connect(self.subscribe)

        # mouse interaction signals
        self.clicked = self.js.leftclicked
        self.rightClicked = self.js.rightclicked
        self.hovered = self.js.hovered
        self.clicked.connect(self.on_click)
        self.rightClicked.connect(self.on_rightclick)
        self.hovered.connect(self._on_hover)

        # Inject JSInterface into the JS global namespace as "Backend"
        def addBackend():
            frame.addToJavaScriptWindowObject('Backend', self.js)
        view.connect(frame, QtCore.SIGNAL("javaScriptWindowObjectCleared()"), addBackend)

        # load the page
        # need to set the "base URL" for the webview to find the
        # resources (js, css).
        base_url = QtCore.QUrl().fromLocalFile(
            os.path.dirname(__file__) + "/web/")

        # some ugly magic to get the path to the SVG file right. It
        # needs to be absolute because local paths go to the base URL.
        abspath = os.path.dirname(os.path.abspath(html))
        with open(html) as f:
            text = f.read().replace("${path}", abspath)  # TODO: use template
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

    def on_click(self, kind, name):
        """Default behavior on click. Override to change!"""
        if kind == "section":
            self.zoom_to(kind, name)
        elif kind == "model":
            self.select(kind, [name])

    def on_rightclick(self, kind, name):
        "Placeholder; override me!"
        pass

    def _on_hover(self, section, models):
        splitmodels = models.split("\n") if models else []
        self.on_hover(section, splitmodels)

    def on_hover(self, section, models):
        "Show a basic 'tooltip' when the mouse pointer is over an item."
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
        "Move the view so that the given object is visible"
        self.js.evaluate("synoptic.zoomTo(%r, %r)" % (str(kind), str(name)))

    def select(self, kind, names, replace=True):
        """Set a list of items as 'selected'. By default unselects all
        previously selected things first.
        """
        print "select", kind, names
        if replace:
            self.js.evaluate("synoptic.unselectAll()")
        if names:
            for name in names:
                self.js.evaluate("synoptic.select(%r, %r)" %
                                 (str(kind), str(name)))

    def unselect_all(self):
        self.js.evaluate("synoptic.unselectAll();")
    # def send_debug_message(self, msg):
    #     self.js.evaluate("Tango.debugMessage(%r)" % msg)


if __name__ == '__main__':
    import sys
    print sys.argv[1]
    qapp = Qt.QApplication([])
    sw = SynopticWidget(sys.argv[1])
    sw.show()
    qapp.exec_()
