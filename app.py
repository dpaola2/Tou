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
DROPBOX_REQUEST_KEY = 'dropbox_request_token'
DROPBOX_ACCESS_KEY  = 'dropbox_access_token'

DROPBOX_SESSION     = dropbox_session.DropboxSession(DROPBOX_KEY, DROPBOX_SECRET, DROPBOX_ACCESS_TYPE)

def get_client(access_token):
    sess = DROPBOX_SESSION
    sess.set_token(access_token.key, access_token.secret)
    return dropbox_client.DropboxClient(sess)

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

@app.route('/load_dropbox_file')
def load_dropbox_file():
    dropbox_access_token = session.get(DROPBOX_ACCESS_KEY, None)
    if dropbox_access_token is None:
        return "please log into dropbox first"

    filepath = request.args.get('filepath', None)
    if filepath is None:
        return "You didn't pass a filepath"

    dropbox_client = get_client(dropbox_access_token)
    try:
        f, metadata = dropbox_client.get_file_and_metadata(filepath)
        return str(f.read())
    except Exception, e:
        return e.message

@app.route('/readme')
def readme():
    return open("README.md").read()

@app.route('/link_dropbox')
def link_dropbox():
    if session.get(DROPBOX_ACCESS_KEY, False):
        return redirect('/')
    
    request_token = DROPBOX_SESSION.obtain_request_token()
    session[DROPBOX_REQUEST_KEY] = request_token
    url = DROPBOX_SESSION.build_authorize_url(request_token, oauth_callback = DROPBOX_CALLBACK)
    return redirect(url)

@app.route('/dropbox_callback')
def dropbox_callback():
    request_token_key = request.args.get('oauth_token', None)
    if request_token_key is None:
        return "dropbox didn't give me a token!"

    request_token = session.get(DROPBOX_REQUEST_KEY, None)
    if request_token is None:
        return "couldn't find that token key"
    
    access_token = DROPBOX_SESSION.obtain_access_token(request_token)
    session[DROPBOX_ACCESS_KEY] = access_token
    return redirect('/')

@app.route('/unlink_dropbox')
def unlink_dropbox():
    session.pop(DROPBOX_REQUEST_KEY)
    session.pop(DROPBOX_ACCESS_KEY)
    return redirect('/')

@app.route('/debug_session')
def debug_session():
    return str(session.items())
    
app.run(host='0.0.0.0', port=PORT)
