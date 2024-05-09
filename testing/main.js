const puppeteer = require('puppeteer');

async function scrapeTweetContent(tweetUrl) {
    // Launch a headless browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the tweet URL
    await page.goto(tweetUrl);

    const selector = '#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div > div > section > div > div > div:nth-child(1) > div > div > article'
    // Wait for the tweet content to load
    await page.waitForSelector(selector);
    
    
    // Extract the tweet content
    const tweetContent = await page.evaluate(() => {
        const selector = '#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div > div > section > div > div > div:nth-child(1) > div > div > article'

        const tweetElement = document.querySelector(selector);

        // console.log(">>", tweetElement.textContent)
        // const b = tweetElement.querySelector("")
    //    if (b) {
        
    //        console.log(">>>>>>",b.innerText)
    //    }
        // const obj = {
        //     bookmark : bookmark ? bookmark.innerText : 0
        // }
        return  tweetElement
    });

    // Close the browser
    await browser.close();

    return tweetContent;
}

// URL of the tweet to scrape
const tweetUrl = 'https://twitter.com/EstoniaInvest/status/1786379290386256287';

// Scrape the tweet content and log it
scrapeTweetContent(tweetUrl)
    .then(tweetContent => {

        console.log('Tweet Content:', tweetContent);
        if (tweetContent) {
    //         const data = tweetContent.split("\n")
    //         console.log(data)
    //         const obj = {}
    // for (let i= 0; i < data.length; i++) {
    //     if (data[i].trim() === "Bookmarks" || data[i].trim() === "Likes" || data[i].trim() === "Quotes" || data[i].trim() === "Reposts") {
            
    //         obj[data[i].trim()] = data[i - 1].trim();

    //     }
    //     else if (data[i].trim() === "From") {
    //         obj[data[i].trim()] = data[i + 1].trim();
    //         obj["date"] = data[i + 2].trim();
    //         obj["Views"] = data[i + 4].trim();

    //     }

    //     else if (data[i].trim() === "Follow") {
            
    //         obj["tweet"] = data[i + 1].trim();
    //     }

    //     else if (data[i].trim()[0] === "@") {
            
    //         obj["username"] = data[i].trim();
    //     }
        
    // }

    // console.log(obj)

        } else {
            console.log('Tweet not found or could not be scraped.');
        }
    })
    .catch(error => {
        console.error('Error scraping tweet:', error);
    });



    // https://twitter.com/NoContextHumans/status/1787489998339547398
    // https://twitter.com/itsme_urstruly/status/1787506347183157687
    // https://twitter.com/EstoniaInvest/status/1786379290386256287
    // https://twitter.com/Airbus/status/1787497957727605041
    // https://twitter.com/elonmusk/status/1787165820512051626

//*[@id="id__2cf8qn165hr"]/div[4]/div/div/div[2]/span/span/span


// #react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div > div > section > div > div > div:nth-child(1) > div > div > article

// /html/body/div[1]/div/div/div[2]/main/div/div/div/div/div/section/div/div/div[1]/div/div/article/div/div/div[3]/div[5]/div/div/div[4]/div/div/div[2]/span/span/span