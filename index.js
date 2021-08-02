const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const csvWriter = require('csv-writer').createObjectCsvWriter({
    path: path.join(__dirname, 'averageGAS.csv'),
    header: [{id: 'gas'}],
});

const config = require('./config.json');

fs.appendFileSync('averageGAS.csv', '');


const connect = async () => {
    const browser = await puppeteer
        .launch({
            args: [],
            headless: true,
        });
    const page = await browser.newPage();

    await allAction(page);
};


const allAction = async (page) => {
    if (config.URL === '') {
        throw new Error('Url is empty.');
    } else {
        await page.goto(config.URL);
        const allLinks = await parseMain(page);
        const data = await getTransData(page, allLinks);

        if (data.length > 0) {
            const arrGas = data.map((item) => item.gas);
            const medianValue = median(arrGas);
            await saveCSV(medianValue);
            showData(medianValue);

            await allAction(page);
        } else {
            await allAction(page);
        }
    }
};


const parseMain = async (page) => {
    const classLink = `.myFnExpandBox_searchVal`;

    return await page.evaluate((classLink) => {
        const arr = [];

        const pathToLink = document.querySelectorAll(`${classLink}`);
        for (let link of pathToLink) {
            if (link.getAttribute('href') === null) {
                arr.push(link.children[0].href);
            } else {
                arr.push(`https://etherscan.io/${link.getAttribute('href')}`);
            }
        }
        return arr;
    }, classLink);
};

const getTransData = async (page, links) => {
    const data = [];

    const status = `.u-label--success`;
    const gasPrice = '#ContentPlaceHolder1_spanGasPrice';
    const wayOne = '.media-body span:nth-child(3)';
    const wayTwo = '.media-body > span:nth-child(6)';

    for (let href of links) {
        await page.goto(href);
        const structure = await page.evaluate((status, gasPrice, wayOne, wayTwo) => {
            const info = {
                link: location.href,
            };
            if (document.querySelector(`${status}`) === null) {
                info.statys = 'Pending';
                if (document.querySelector(`${wayOne}`) !== null) {
                    info.price = document.querySelector(`${wayOne}`).innerText;
                }
                if (document.querySelector(`${gasPrice}`) !== null) {
                    info.gas = document.querySelector(`${gasPrice}`).innerText;
                }
            } else {
                info.statys = 'Success';
                if (document.querySelector(`${wayTwo}`) !== null) {
                    info.price = document.querySelector(`${wayTwo}`).innerText;
                }
                if (document.querySelector(`${gasPrice}`) !== null) {
                    info.gas = document.querySelector(`${gasPrice}`).innerText;
                }
            }
            return info;
        }, status, gasPrice, wayOne, wayTwo);
        data.push(structure);
    }

    return filterData(data);
};

const filterData = (arr) => arr.filter((item) => {
    if (item.price !== undefined) {
        item.price = getDataFromStringPrice(item.price);
        item.gas = getDataFromStringGas(item.gas);

        if (item.price >= config.PRICE) return item;
    }
});

const median = (arr) => {
    checkGasArr(arr);
    if (arr.length === 0) return -1;
    arr.sort((a, b) => a - b);

    const half = Math.trunc(arr.length / 2);

    if (arr.length % 2 === 0) return Math.trunc((arr[half - 1] + arr[half]) / 2);

    return arr[half];
};

const saveCSV = async (data) => {
    const records = [{gas: `Gas: ${data.toLocaleString()}`}];
    await csvWriter.writeRecords(records);
};


connect();


//tools
const getDataFromStringPrice = (price) => {
    let sum = '';
    if (price.indexOf('For') !== -1) {
        sum += price.split(' ')[1];
    } else {
        sum += price.split(' ')[0];
    }
    return Number(sum.replace(/,/, ''));
};

const getDataFromStringGas = (gas) => {
    const sum = gas.split(' ')[2];
    return sum[0] === '(' ? Number(sum.substr(1)) : Number(sum);
};

const checkGasArr = (arr) => arr.filter(item => typeof item === 'number');

const showData = (data) => console.log(data);

