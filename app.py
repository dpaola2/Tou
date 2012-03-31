#! /usr/bin/env python

import os
import requests
from flask import Flask, flash, render_template, request

app = Flask(__name__)

PORT = int(os.environ.get("PORT", '5000'))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/load_file')
def load_file():
    url = request.args.get('url', None)
    if url is None:
        return "No URL specified."
    try:
        r = requests.get(url)
        return r.text
    except Exception, e:
        return e.message

@app.route('/readme')
def readme():
    return open("README.md").read()
    
app.debug = True
app.run(host='0.0.0.0', port=PORT)
