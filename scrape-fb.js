const puppeteer = require('puppeteer');
const fs = require('fs');

const credentials = {
    email: null,
    password: null,
};

const showInBrowser = true;
const outputFilename = 'listings.json';
const searchLocation = 'Singapore';
const queries = [];
const listings = [];

const storeData = async (data, path) => {
    return new Promise((res, rej) => {
        try {
            const json = JSON.stringify(data);
            fs.writeFileSync(path, json);
            res(json);
        } catch (err) {
            console.error(err);
            rej(error);
        }
    });
};

const logError = (...params) => {
    console.log(' [ Error! ]', ...params);
};

const sleep = async (ms) => {
    return new Promise((res, rej) => {
        setTimeout(() => {
            res();
        }, ms);
    });
};

const loginToFacebook = async (page) => {
    await page.goto('https://facebook.com', {
        waitUntil: 'networkidle2',
    });

    await page.waitForSelector('#email');
    await page.type('#email', credentials.email);
    await page.type('#pass', credentials.password);
    await sleep(500 * 2);
    await page.click('button[name="login"]');
    await page.waitForNavigation();
    await sleep(500 * 2);

    console.log('Login completed!');
};

const closeBlockedDialog = async (page, reload = false) => {
    console.log('Checking for and closing any blocked dialog');
    // Await for page
    await sleep(600 * 4);

    // Check for blocked dialog
    const blockedDialog = await page.$('[aria-label="You’re Temporarily Blocked"]');
    const hasBlockedDialog = blockedDialog !== null;

    if (hasBlockedDialog) {
        console.log('Closing the blocked dialog');
        const closeButtonElement = await blockedDialog.$('[aria-label="Close"]');

        if (closeButtonElement) {
            await closeButtonElement.click();
            await sleep(600 * 4);
            if (reload) {
                await page.reload();
                await sleep(600 * 8);
            }
        }
    }
};

const fetchPageData = async (page, url) => {
    console.log(`Fetching data from url: ${url}`);

    await page.goto(url, {
        waitUntil: 'networkidle2',
    });
    
    await page.waitForSelector('a[href$="about"]');
    await closeBlockedDialog(page);
    await page.click('a[href$="about"]');
    await sleep(600 * 6);

    // Check for blocked dialog
    await closeBlockedDialog(page, true);

    // Check if has location/map link element
    const locationLinkElement = await page.$('a[rel="nofollow noopener"]');
    const hasLocationElement = locationLinkElement !== null;

    // First get address and coordinates
    let location = { address: null, coordinates: null };

    if (hasLocationElement) {
        location = await page.$eval('a[rel="nofollow noopener"]', (node) => {
            if (!node) {
                return { address: null, coordinates: null };
            }

            const address = node?.querySelector('span > span')?.innerText ?? null;
            let coordinates = null;

            const nodeUrl = node?.getAttribute('href') ? new URL(node?.getAttribute('href')) : null;

            if (nodeUrl) {
                const googleMapsUrl = nodeUrl?.searchParams?.get('u') ?? null;
                coordinates = googleMapsUrl ? new URL(googleMapsUrl)?.searchParams?.get('destination') : null;
            }

            return { address, coordinates };
        });
    }

    // Get page/logo image url
    const logoImageElement = await page.$('[aria-label$="profile photo"] image');
    const hasLogoImageElement = logoImageElement !== null;

    let logoUrl = null;

    if (hasLogoImageElement) {
        logoUrl = await page.$eval('[aria-label$="profile photo"] image', (node) => {
            if (!node) {
                return { logoUrl: null };
            }

            const logoUrl = node.getAttribute('xlink:href') ?? null;

            return { logoUrl };
        });
    }

    // Check if has h2 element
    const detailsContainerElement = await page.$('h2');
    const hasDetailsElementContainer = detailsContainerElement !== null;

    // Get name and category and image
    let details = { name: null, category: null };

    if (hasDetailsElementContainer) {
        details = await page.$eval('h2', (node) => {
            if (!node) {
                return { name: null, category: null };
            }

            const container = node?.parentElement?.parentElement;
            const name = container?.firstElementChild?.querySelector('span')?.innerText;
            const detailsArray = container?.lastElementChild?.querySelector('span > span')?.innerText?.split('·');
            const category = detailsArray[detailsArray.length - 1]?.trim();

            return { name, category };
        });
    }

    // Attempt to get page hours if available
    // Check if has hours icon
    const hoursIconElement = await page.$('i[style*="-595px"]');
    const hasHoursIconElement = hoursIconElement !== null;

    let hours = [];

    if (hasHoursIconElement) {
        // search for hours button to press
        const hoursButtonCoordinates = await hoursIconElement.clickablePoint({ x: 35, y: 20 });

        // click the hours button to trigger the dialog open
        await page.mouse.click(hoursButtonCoordinates.x, hoursButtonCoordinates.y);

        // check if dialog opened
        const hoursDialogElement = await page.$('div[role="dialog"]');
        const hasHoursDialogElement = hoursDialogElement !== null;

        // get hours
        if (hasHoursDialogElement) {
            hours = await page.$eval('div[role="dialog"]', (node) => {
                const rows = Array.from(node.firstElementChild.firstElementChild.children);
                const schedule = [];

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const day = row.firstElementChild?.querySelector('span')?.innerText?.replace(':', '').trim();
                    const hours = row.lastElementChild?.querySelector('span')?.innerText?.trim();

                    schedule.push({ day, hours });
                }

                return schedule;
            });
        }

        // click the hours button to trigger the dialog closed
        await page.mouse.click(hoursButtonCoordinates.x, hoursButtonCoordinates.y);
    }

    // Attempt to get price range
    // Check if has price range icon
    const priceRangeIconElement = await page.$('i[style*="-679px"]');
    const hasPriceRangeIconElement = priceRangeIconElement !== null;

    let priceRange = null;
    if (hasPriceRangeIconElement) {
        priceRange = await priceRangeIconElement.evaluate((node) => {
            const priceDetailsArray = node.parentElement.parentElement.lastElementChild.firstElementChild.firstElementChild.querySelector('span > span').innerText?.split('·');
            return Array.isArray(priceDetailsArray) ? priceDetailsArray[priceDetailsArray.length - 1]?.trim() : null;
        });
    }

    // Attempt to get website
    // Check if has website url icon
    const websiteIconElement = await page.$('i[style*="-868px"]');
    const hasWebsiteIconElement = websiteIconElement !== null;

    let websiteUrl = null;
    if (hasWebsiteIconElement) {
        websiteUrl = await websiteIconElement.evaluate((node) => {
            return node?.parentElement?.parentElement?.lastElementChild?.firstElementChild?.firstElementChild?.querySelector('span > span')?.innerText ?? null;
        });
    }

    // Attempt to get phone number
    // Check if has phone icon
    const phoneIconElement = await page.$('i[style*="-1015px"]');
    const hasPhoneIconElement = phoneIconElement !== null;

    let phone = null;
    if (hasPhoneIconElement) {
        phone = await phoneIconElement.evaluate((node) => {
            return node?.parentElement?.parentElement?.lastElementChild?.firstElementChild?.firstElementChild?.querySelector('span > span')?.innerText ?? null;
        });
    }

    // Attempt to get email address
    // Check if has email icon
    const emailIconElement = await page.$('i[style*="-700px"]');
    const hasEmailIconElement = emailIconElement !== null;

    let email = null;
    if (hasEmailIconElement) {
        email = await emailIconElement.evaluate((node) => {
            return node?.parentElement?.parentElement?.lastElementChild?.firstElementChild?.firstElementChild?.querySelector('span > span')?.innerText ?? null;
        });
    }

    // Attempt to get description
    // Check if has description
    const descriptionIconElement = await page.$('i[style*="-126px"]');
    const hasDescriptionIconElement = descriptionIconElement !== null;

    let description = null;
    if (hasDescriptionIconElement) {
        description = await descriptionIconElement.evaluate((node) => {
            return node?.parentElement?.parentElement?.lastElementChild?.firstElementChild?.firstElementChild?.querySelector('span')?.innerText?.replace('About\n', '')?.trim() ?? null;
        });
    }

    // Attempt to get instagram
    // Check if has instagram icon
    const instagramIconElement = await page.$('i[style*="-146px"]');
    const hasInstagramIconElement = instagramIconElement !== null;

    let instagram = null;
    if (hasInstagramIconElement) {
        instagram = await instagramIconElement.evaluate((node) => {
            return node?.parentElement?.parentElement?.lastElementChild?.firstElementChild?.firstElementChild?.querySelector('span')?.innerText ?? null;
        });
    }

    const data = Object.assign({}, details, location, logoUrl, { facebookUrl: url, hours, priceRange, websiteUrl, phone, email, instagram, description });
    console.log('Got data', data);

    listings?.push(data);
};

const startSearch = async (page, query) => {
    await page.goto(`https://www.facebook.com/search/pages?q=${query}`, {
        waitUntil: 'networkidle2',
    });

    const setLocation = async (page, search = '') => {
        console.log(`Now setting search location to: ${search}`);
        await sleep(500);
        await page.waitForSelector('div.dicw6rsg.oi9244e8.lwwyvkzy.qjjbsfad > div + div > div > div > div > div > div > div > div > div');
        await page.click('div.dicw6rsg.oi9244e8.lwwyvkzy.qjjbsfad > div + div > div > div > div > div > div > div > div > div');
        await sleep(500);
        await page.type('input[placeholder="Choose a town or city..."]', search);
        await sleep(500);
        await page.waitForSelector('ul[aria-label="5 suggested searches"] > li > div');
        await page.click('ul[aria-label="5 suggested searches"] > li > div');
    };

    console.log(`Search for ${query} completed!`);

    await closeBlockedDialog(page);
    await sleep(500);
    await setLocation(page, searchLocation);
    await sleep(500 * 3);

    console.log('Waiting on results...');

    // Now we're going to iterate over results and scrape
    await page.waitForSelector('div[role="feed"]');
    await sleep(600 * 2);

    // Check if blocked
    await closeBlockedDialog(page);

    // Now we will scroll down then collect links
    console.log('Starting to scroll results');
    const downKeys = 600;
    for (let i = 1; i < downKeys; i++) {
        await page.keyboard.press('ArrowDown');
        // await sleep(300);
        // await closeBlockedDialog(page);
    }

    const results = await page.$$eval('div[role="feed"] > div > div', (nodes) => nodes.map((n) => n.querySelector('a[role="link"]')?.getAttribute('href')).filter(Boolean));

    console.log('Found results!', results);

    for (let i = 0; i < results.length; i++) {
        await fetchPageData(page, results[i]);
        await sleep(600 * 8);
    }
};

(async () => {
    const browser = await puppeteer.launch({
        headless: !showInBrowser,
        defaultViewport: {
            width: 1024,
            height: 1024,
        },
    });
    const page = await browser.newPage();

    await loginToFacebook(page).catch(logError);

    for (let i = 0; i < queries.length; i++) {
        const query = queries[i];

        await startSearch(page, query).catch(logError);
        await sleep(600 * 8);
        await storeData(listings, outputFilename);
    }

    console.log('Data scraping completed!');

    await browser.close();
})();
