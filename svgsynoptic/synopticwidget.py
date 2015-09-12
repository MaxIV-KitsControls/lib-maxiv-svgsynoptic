"""
A Qt widget that displays a SVG based synoptic view.
It allows navigation in the form of zooming, panning and clicking
various areas to zoom in.
"""

import logging

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

    Basically all interaction is handled by JS on the webview side,
    here we just connect the JS and Tango sides up.
    """

    subscribe = QtCore.pyqtSignal(str)

    def __init__(self, url=None, parent=None, *args, **kwargs):
        super(SynopticWidget, self).__init__(parent)
        self.subscribe.connect(self._handle_subscriptions)
        self._url = url
        self._setup_ui(url)

    def _setup_ui(self, url=None, section=None):
        hbox = QtGui.QHBoxLayout(self)
        hbox.setContentsMargins(0, 0, 0, 0)
        hbox.layout().setContentsMargins(0, 0, 0, 0)
        if url:
            hbox.addWidget(self._create_view(url, section))

        self.setLayout(hbox)

    def set_url(self, url):
        # TODO: probably breaks things if the url is already set
        self._url = url
        self._create_view(url)

    def _create_view(self, html, section=None):
        "Create the webview that will display the synoptic itself"
        view = QWebView(self)

        # This is supposedly an optimisation. Disable if there are
        # graphical artifacts or something.
        view.settings().TiledBackingStoreEnabled = True
        view.setRenderHint(QtGui.QPainter.TextAntialiasing, False)

        view.setPage(LoggingWebPage())
        view.setContextMenuPolicy(QtCore.Qt.PreventContextMenu)

        # the HTML page that will contain the SVG
        html = QtCore.QUrl(html)

        # setup the JS interface
        frame = view.page().mainFrame()
        self.js = JSInterface(frame)
        # connect the registry to handle subscription changes
        self.js.subscription.connect(self.subscribe)

        # mouse interaction signals
        self.clicked = self.js.leftclicked
        self.rightClicked = self.js.rightclicked
        self.clicked.connect(self.on_click)
        self.rightClicked.connect(self.on_rightclick)

        # Inject JSInterface into the JS global namespace as "Widget"
        frame.addToJavaScriptWindowObject('Widget', self.js)  # confusing?

        # def zoom():
        #     if section:
        #         self.js.evaluate("synoptic.zoomTo('section', %r);"  % section)

        #view.loadFinished.connect(zoom)  # zoom to the optional element

        # load the page
        view.load(html)

        return view

    def _handle_subscriptions(self, models):
        # we get the subscribed models as a comma separated list from Qt,
        # let's deliver something neater.
        if models:
            self.handle_subscriptions(str(models).split(","))
        else:
            self.handle_subscriptions([])

    def handle_subscriptions(self, models):
        # This noop needs to be overridden in order for subscriptions
        # to work!
        # "models" is a list of models that are currently visible
        # in the synoptic.
        print models
        pass

    def on_click(self, kind, name):
        """Default behavior on click is to select the item. Override
        to change!"""
        self.select(kind, name)

    def on_rightclick(self, kind, name):
        "Placeholder; override me!"
        pass

    # # # 'Public' API # # #

    def zoom_to(self, kind, name):
        "Move the view so that the given object is visible"
        self.js.evaluate("synoptic.zoomTo(kind, %r)" % str(name))

    def select(self, kind, names, replace=True):
        """Set a list of items as 'selected'. By default unselects all
        previously selected things first.
        """
        if replace:
            self.js.evaluate("synoptic.unselectAll()")
        if names:
            for name in names:
                self.js.evaluate("synoptic.select(%r, %r)" %
                                 (str(kind), str(name)))

    # def send_debug_message(self, msg):
    #     self.js.evaluate("Tango.debugMessage(%r)" % msg)


if __name__ == '__main__':
    import sys
    print sys.argv[1]
    qapp = Qt.QApplication([])
    sw = SynopticWidget(sys.argv[1])
    sw.show()
    qapp.exec_()
