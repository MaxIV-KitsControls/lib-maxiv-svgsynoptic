#!/usr/bin/env python

from distutils.core import setup

setup(
    name="python-svgsynoptic",
    version="1.0.0",
    description="Widget for displaying a SVG synoptic.",
    author="Johan Forsberg",
    author_email="johan.forsberg@maxlab.lu.se",
    license="GPLv3",
    url="http://www.maxlab.lu.se",
    packages=['svgsynoptic'],
    package_data={'svgsynoptic': ['web/js/*.js', 'web/js/libs/*.js', 'web/css/*.css']}
)
