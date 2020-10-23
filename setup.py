#!/usr/bin/env python

from setuptools import setup

setup(
    name="python-svgsynoptic2",
    version="4.0.0",
    description="Widget for displaying a SVG synoptic.",
    author="Johan Forsberg",
    author_email="johan.forsberg@maxlab.lu.se",
    license="GPLv3",
    setup_requires=["setuptools"],
    install_requires=["setuptools", "pytango>=9.2.1", "taurus>=4.5", "pyqtwebengine"],
    url="http://www.maxlab.lu.se",
    packages=['svgsynoptic2'],
    include_package_data=True,
    package_data={'svgsynoptic2': ['web/js/*.js', 'web/js/libs/*.js', 'web/css/*.css']}
)
