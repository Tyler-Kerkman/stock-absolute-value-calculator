const axios = require("axios");
const mongo = require('mongodb');
const { MongoClient } = require('mongodb');
const cheerio = require('cheerio');

const customUrl = 'mongodb+srv://react-user:reactuserpass@testdeployment.gbc5rpa.mongodb.net/test';
const client = new MongoClient(customUrl);

// random stock
let stock = {
  // from api
  ticker: '',
  marketCap: 0,
  debtToEquity: 0,
  incomeTaxExpense: 0,
  incomeBeforeTax: 0,
  totalDebt: 0,
  interestExpense: 0,
  beta: 0,
  revenue: 0,
  netIncome: 0,
  netIncomeMargins: 0,
  freeCashFlow: 0,
  estimatedNetIncome: 0,
  freeCashFlowRate: 0,
  sharesOutstanding: 0,
  // scraped
  currentYearRevenue: 0,
  nextYearRevenue: 0,
  projectedRevenueGrowthRate: 0,
  tenYearTreasuryBond: 0,
  // constants
  perpetualGrowthRate: .025,
  timePeriod: 5,
  annualReturnOfSandP: .10,

};

let updatingStock = {
  // from api
  projectedRevenue: 0,
  previousRevenue: 0,
  estimatedNetIncome: 0,
  projectedFreeCashFlow: 0,
  estimatedNetIncome: 0,
  deltaProjectedRevenue: 0,
  projectedRevenueGrowthRate: 0,


};

let wacc = 0;

let fcf = [];

async function getAPIData() {
  // console.log(stock.ticker);

  const options = {
    method: 'GET',
    url: 'https://mboum-finance.p.rapidapi.com/mo/module/',
    params: { symbol: stock.ticker, module: 'asset-profile,financial-data,default-key-statistics,cashflow-statement,income-statement' },
    headers: {
      'X-RapidAPI-Key': 'acfdf1287emshe2dce3fb89abdb0p133778jsn6dbb840f4a64',
      'X-RapidAPI-Host': 'mboum-finance.p.rapidapi.com'
    }
  };

  await axios.request(options).then(function (response) {
    data = response.data;
    // takes data from api and sets attributes of the stock object to values from api
    stock.incomeBeforeTax = data.incomeStatementHistory.incomeStatementHistory[0].incomeBeforeTax.raw;
    stock.incomeTaxExpense = data.incomeStatementHistory.incomeStatementHistory[0].incomeTaxExpense.raw;
    stock.totalDebt = data.financialData.totalDebt.raw;
    stock.sharesOutstanding = data.defaultKeyStatistics.sharesOutstanding.raw/1000;
    stock.beta = data.defaultKeyStatistics.beta.raw;
    stock.revenue = data.financialData.totalRevenue.raw;
    stock.freeCashFlow = data.financialData.freeCashflow.raw;
    stock.debtToEquity = data.financialData.debtToEquity.raw;
    stock.revenue = data.financialData.totalRevenue.raw;
    stock.interestExpense = data.incomeStatementHistory.incomeStatementHistory[0].interestExpense.raw;
    stock.netIncome = data.incomeStatementHistory.incomeStatementHistory[0].netIncome.raw;
    stock.netIncomeMargins = stock.netIncome / stock.revenue;
    stock.freeCashFlowRate = stock.netIncome / stock.freeCashFlow;
    // console.log(stock);
  }).catch(function (error) {
    console.error(error);
  });


}

// gets all the items in the collection of the mongoDB
function getInfoFromDB() {
  client.connect().then(function () {
    let db = client.db('testdeployment');
    let collection = db.collection('tickers');
    // finds all items with an id and prints them
    collection.find({ '_id': { $gt: 0 } }).toArray(function (err, res) {
      if (err != undefined) throw err;
      console.log("Document found", res);
    })

  });
}

// sends a stock object to the collection
function sendInfoToDB() {
  client.connect().then(function () {
    let db = client.db('testdeployment');
    let collection = db.collection('tickers');
    // boilerplate stock
    let bpStock = {
      '_id': 6, 'ticker': 'AAPL', 'price': 289, 'DCF': 3.2, 'date added': new Date('2014-03-01T08:00:002')
    }
    collection.insertOne(bpStock, function (err, res) {
      if (err != undefined) throw err;
      console.log("Document inserted", bpStock);
    });
  });
}

// TODO
function calculateDCF() {


}

function caluclateCF(){





}

function year1(){



}

function calculateDiscountRate(){



}

async function getTreasuryYield() {
  // webscrapes from yahoo finance website, not using yet
    const url = `https://finance.yahoo.com/quote/%5ETNX?p=^TNX&.tsrc=fin-srch`;
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const treasuryYield = $('[data-test="qsp-price"]').text();
      stock.tenYearTreasuryBond = 1 + (parseFloat(treasuryYield)/100);

    } catch (e) {
      console.error(`${e.message}`);
    }

}


async function getRevenueGrowth() {
  // console.log(' runs get revenue growth');
  // webscrapes from yahoo finance website
    const companySymbol = stock.ticker.toUpperCase();
    const url = `https://finance.yahoo.com/quote/${companySymbol}/analysis?p=${companySymbol}`;
    try {
      var years = [];
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // gets all values in a specific table
      $('.BdT').each(function () {
        years.push($(this).text().trim());
      });

      // picks the specific row with the values we want
      let revenueEstimateRow = years[6];
      // turns the string into a array that seperates the values into 'number + (B/M/T)' pattern
      revenueEstimateRow = revenueEstimateRow.replace("Avg. Estimate", "").replaceAll("B", "B,").replaceAll("M", "M,").split(',');
      // array of the two values we want
      // revenues[0] is the current years growth rate
      // revenues[1] is next years estimated growth rate
      let revenues = [revenueEstimateRow[2], revenueEstimateRow[3]];

      // converts the values in base 10
      // ie. 100 M -> 100,000,000
      for (let i in revenues) {
        if (revenues[i].includes('B')) {
          let val = parseFloat(revenues[i]);
          revenues[i] = val * 1000000000;
        } else if (revenues[i].includes('M')) {
          let val = parseFloat(revenues[i]);
          revenues[i] = val * 1000000;
        }
      }

      stock.currentYearRevenue = revenues[0];
      stock.nextYearRevenue = revenues[1];


    } catch (e) {
      console.error(`${e.message}`);
    }

}

async function getMarketCap() {
  // console.log(' runs marketcap');
  // Webscarpe from yahoo finance
    const url = `https://finance.yahoo.com/quote/${stock.ticker}/`;
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      // gets the value in string form, has a base on it (B/M/T)
      let marketCap = $('[data-test="MARKET_CAP-value"]').text();

      // parses value into integer
      if (marketCap.includes('B')) {
        let val = parseFloat(marketCap);
        stock.marketCap = val * 1000000000;
      } else if (marketCap.includes('M')) {
        let val = parseFloat(marketCap);
        stock.marketCap = val * 1000000;
      } else if (marketCap.includes('T')) {
        let val = parseFloat(marketCap);
        stock.marketCap = val * 1000000000000;
      }

    } catch (e) {
      console.error(`${e.message}`);
    }


}

// gets the symbol, and turns it to uppercase
// no validation yet
async function getTickerSymbol() {
  let str = "";
  const prompt = require("prompt-sync")({ sigint: true });
  const companySymbol = prompt("Company ticker symbol: ");
  str = companySymbol.toUpperCase();
  stock.ticker = str;
}

function printStock() {
  console.log(stock);
}

function printF(){
  return "F";
}

function calculatePresentValue(totalFCF){
  let i = (totalFCF) / Math.pow((1 + wacc), 4);
  return i;
}

async function getRevenueGrowthRate(){

  let i = (stock.nextYearRevenue - stock.currentYearRevenue) / stock.nextYearRevenue;
  let j = (stock.currentYearRevenue - stock.revenue) / stock.currentYearRevenue;
  let k = (i + j) / 2;
  stock.projectedRevenueGrowthRate = k + 1;


}

async function calculateWACC(){
  val = 0;
  e = stock.marketCap;
  d = stock.totalDebt;
  rd = stock.interestExpense / stock.totalDebt;
  re = stock.tenYearTreasuryBond + stock.beta * (1.11 - stock.tenYearTreasuryBond);
  val = ((d / (e + d)) * rd) + ((e / (e + d)) * re) * (1 - (stock.incomeTaxExpense / stock.incomeBeforeTax));
  return val/10;
}

function calculateTV(val){

  tv = val * (1 + stock.perpetualGrowthRate) / (wacc - stock.perpetualGrowthRate);
  return tv;

}

async function doThing(){
//  const tempStock = await setData();
 await setData();

 getRevenueGrowthRate();

 wacc = await calculateWACC();
 console.log(wacc);
 
 // Year 1
 updatingStock.previousRevenue = stock.currentYearRevenue;
 updatingStock.projectedRevenue = stock.nextYearRevenue;
 updatingStock.estimatedNetIncome = stock.netIncomeMargins * updatingStock.projectedRevenue;
 updatingStock.projectedFreeCashFlow = updatingStock.estimatedNetIncome * stock.freeCashFlowRate;
 fcf.push(updatingStock.projectedFreeCashFlow);
//  console.log(updatingStock.projectedFreeCashFlow);
  // Year 2 - 5
  for(i = 0; i < 4; i++){
    updatingStock.previousRevenue = updatingStock.projectedRevenue;
    updatingStock.projectedRevenue = updatingStock.previousRevenue * stock.projectedRevenueGrowthRate;
    updatingStock.estimatedNetIncome = stock.netIncomeMargins * updatingStock.projectedRevenue;
    updatingStock.projectedFreeCashFlow = updatingStock.estimatedNetIncome * stock.freeCashFlowRate;
    fcf.push(updatingStock.projectedFreeCashFlow);
  }

 


  // console.log(updatingStock.projectedFreeCashFlow);
  terminalValue = calculateTV(updatingStock.projectedFreeCashFlow);
  console.log(terminalValue);

  console.log(fcf);
  let sum = 0;
  for(i=1; i < 5; i++){
    pv = fcf[i] / Math.pow((1+wacc), i);
    sum += pv;

  }
  sum += (terminalValue / Math.pow((1+wacc), 4));
  let presentValue = sum / (stock.sharesOutstanding / 1000);
  console.log(presentValue);



  console.log(stock);
  console.log(updatingStock);
}

async function setData() {
  // necessity to put first
  // gets the ticker symbol for the stock
  await getTickerSymbol();

  // sets the market cap of the stock
  await getMarketCap();

  // sets the projectedRevenueGrowthRate of the stock
  await getRevenueGrowth();

  // sets the rest of the data for the stock
  await getAPIData();

  // gets the treasury yield
  /** TO USE LATER
   *   getTreasuryYield();
   */

  // return stock;
  await getTreasuryYield();
}

// setData();

doThing();

/**
 * TODO
 * getInfoFromDB()
 * sendInfoToDB();
 * calculateDCF();
 * 
 */