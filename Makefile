all: virtualenv install

virtualenv:
	virtualenv --no-site-packages .

install:
	source bin/activate && pip install -r requirements.txt

serve:
	DEBUG=true source bin/activate && foreman start -p 5000

deploy:
	git push heroku master

clean:
	rm -rf bin lib include build