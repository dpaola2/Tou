all: virtualenv install

virtualenv:
	virtualenv --no-site-packages .

install:
	source bin/activate && pip install -r requirements.txt

serve:
	foreman start -p 5000