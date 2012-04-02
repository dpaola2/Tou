#! /usr/bin/env python

import os
import requests
from flask import Flask, flash, render_template, request, redirect, session
from dropbox import (
    client as dropbox_client,
    rest as dropbox_rest,
    session as dropbox_session
)

app                 = Flask(__name__)
app.debug           = False
if os.environ.get('DEBUG', False):
    app.debug = True
app.secret_key      = 'briansucks'
host                = "tou.herokuapp.com"
if app.debug:
    host = "localhost:5000"

PORT                = int(os.environ.get("PORT", '5000'))
DROPBOX_KEY         = 'whxozioi915s2wr'
DROPBOX_SECRET      = '9605perofirq9tg'
DROPBOX_ACCESS_TYPE = 'dropbox'
DROPBOX_CALLBACK    = 'http://%s/dropbox_callback' % host
DROPBOX_SESSION_KEY = 'dropbox_token'

DROPBOX_SESSION     = dropbox_session.DropboxSession(
    DROPBOX_KEY,
    DROPBOX_SECRET,
    DROPBOX_ACCESS_TYPE
)

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

@app.route('/link_dropbox')
def link_dropbox():
    request_token = DROPBOX_SESSION.obtain_request_token()
    url = DROPBOX_SESSION.build_authorize_url(request_token, oauth_callback = DROPBOX_CALLBACK)
    return redirect(url)

@app.route('/dropbox_callback')
def dropbox_callback():
    oauth_token = request.args.get('oauth_token', None)
    if oauth_token is None:
        return "dropbox didn't give me a token!"

    session[DROPBOX_SESSION_KEY] = oauth_token
    return redirect('/')

@app.route('/unlink_dropbox')
def unlink_dropbox():
    session.pop(DROPBOX_SESSION_KEY)
    return redirect('/')

@app.route('/debug_session')
def debug_session():
    return str(session.items())
    
app.run(host='0.0.0.0', port=PORT)
