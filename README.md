# facebook-biz-scrapper

This is a simple node script which provided an array of search queries (ex "last mile delivery" or "pizzeria") and location (ex "Charlotte, NC" or "Singapore") will use puppeteer to scrape facebook pages and collect business information into a JSON file. 

The information scraped includes:

* Business name
* Business category
* Business address
* Business coordinates
* Business logo url (expires)
* Business facebook page url
* Business hours of operation
* Business price range (if applicable)
* Businesss website url
* Business phone number
* Business email address
* Business instagram url/username
* Business description

# Running the scraper

Make sure you have puppeteer installed globally

```npm install -g puppeteer```

Clone the repo and run

```node scrape-fb.js```
