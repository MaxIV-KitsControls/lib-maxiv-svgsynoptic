from PyQt4 import QtCore
from threading import Lock


class JSInterface(QtCore.QObject):

    """
    Interface between python and a webview's javascript.

    All methods decorated with "pyqtSlot" on this class can be called
    from the JS side.
    """

    subscription = QtCore.pyqtSignal(str)
    rightclicked = QtCore.pyqtSignal(str, str)
    leftclicked = QtCore.pyqtSignal(str, str)
    evaljs = QtCore.pyqtSignal(str)
    lock = Lock()

    def __init__(self, frame, parent=None):
        self.frame = frame
        super(JSInterface, self).__init__(parent)
        self.evaljs.connect(self._evaluate_js)

    def evaluate(self, js):
        # This is probably totally unneccesary
        self.evaljs.emit(js)

    def _evaluate_js(self, js):
        with self.lock:
            self.frame.evaluateJavaScript(js)

    @QtCore.pyqtSlot(str, str)
    def left_click(self, kind, name):
        print "left_click", kind, name
        self.leftclicked.emit(kind, name)

    @QtCore.pyqtSlot(str, str)
    def right_click(self, kind, name):
        self.rightclicked.emit(kind, name)

    @QtCore.pyqtSlot(str)
    def subscribe(self, devices):
        "Update the list of attributes to pay attention to"
        self.subscription.emit(devices)

    @QtCore.pyqtSlot()
    def setup(self):
        pass

    @QtCore.pyqtSlot()
    def load_svg(self, svg, section=None):
        "Load an SVG file"
        print "load", svg
        if section:
            self.evaljs.emit("Synoptic.load(%r, %r)" % (svg, section))
        else:
            self.evaljs.emit("Synoptic.load(%r)" % svg)
