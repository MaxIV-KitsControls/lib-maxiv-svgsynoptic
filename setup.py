#!/usr/bin/env python

from distutils.core import setup

setup(
    name="python-svgsynoptic2",
    version="2.0.6",
    description="Widget for displaying a SVG synoptic.",
    author="Johan Forsberg",
    author_email="johan.forsberg@maxlab.lu.se",
    license="GPLv3",
    url="http://www.maxlab.lu.se",
    packages=['svgsynoptic2'],
    package_data={'svgsynoptic2': ['web/js/*.js', 'web/js/libs/*.js', 'web/css/*.css']}
)
