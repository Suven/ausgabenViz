const ipc = require('electron').ipcRenderer

const importButton = document.getElementById('import')

importButton.addEventListener('click', function (event) {
  ipc.send('open-file-dialog')
})

ipc.on('selected-directory', function (event, path) {
  document.getElementById('start').style.display = 'none'
  document.getElementById('load').style.display = 'block'
  readCSV(path[0])
})

const fs = require('fs')
const parse = require('csv-parse')

function simplifyData(set) {
  let date = set['Valuta-Datum'] || set['Value date']
  let amount = set['Betrag'] || set['Amount']

  amount = amount.replace(',', '.')
  amount = parseFloat(amount)

  date = moment(date, 'DD.MM.YYYY')

  return { date, amount }
}

const moment = require('moment')

let monthsInPast = 6
let limitDate = moment().subtract(monthsInPast, 'months').startOf('month')

function limitResults(set) {
  return set.date.isAfter(limitDate)
}

function groupByMonth(sets) {
  let months = []

  sets.forEach((set) => {
    const monthNumber = (set.date.year() * 100) + set.date.month()

    if (!months[monthNumber]) {
      months[monthNumber] = { in: 0, out: 0, total: 0, label: set.date.format('MM.YY') }
    }

    if (set.amount > 0) {
      months[monthNumber].in += set.amount
    } else {
      months[monthNumber].out -= set.amount
    }

    months[monthNumber].total += set.amount
  })

  return months
}

function extractLabels(data) {
  return data.map((month) => {
    return month.label
  }).filter(val => val)
}

function extractDirection(data, goIn) {
  return data.map((month, key) => {
    return goIn ? month.in : month.out
  }).filter(val => val)
}

function extractTrendData(data) {
  return data.map((month) => {
    return month.total
  }).filter(val => val)
}

function cumulateData(data) {
  let lastVal = false
  return data.map((point) => {
    lastVal = !lastVal ? point : lastVal + point
    return lastVal
  })
}

const Chart = require('chart.js')
const graphContinous = document.getElementById('graphContinous')
const graphTrend = document.getElementById('graphTrend')

const showTrendButton = document.getElementsByClassName('showTrend')[0]
const showBarsButton = document.getElementsByClassName('showBars')[0]

showTrendButton.addEventListener('click', function() {
  document.getElementById('chart').style.display = 'none'
  document.getElementById('chartTrend').style.display = 'block'
})

showBarsButton.addEventListener('click', function() {
  document.getElementById('chartTrend').style.display = 'none'
  document.getElementById('chart').style.display = 'block'
})

let allData
let data
let groupedData
let labels
let inData
let outData
let trendData
let cumulativeGlory

function recalcCharts() {
  data = allData.filter(limitResults)
  groupedData = groupByMonth(data)
  labels = extractLabels(groupedData)
  inData = extractDirection(groupedData, true)
  outData = extractDirection(groupedData, false)
  trendData = extractTrendData(groupedData)
  cumulativeGlory = cumulateData(trendData)
}

let createdGraphChart
let createdTrendChart

function drawCharts() {
  if (!createdGraphChart) {
    createdGraphChart = new Chart(graphContinous, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'haz moneyz',
          backgroundColor: "rgba(199,244,100,1)",
          data: inData
        }, {
          label: 'lost moneyz',
          backgroundColor: "rgba(255,107,107,1)",
          data: outData
        }]
      },
      options: {
        maintainAspectRatio: false
      }
    })
  } else {
    createdGraphChart.data.labels = labels;
    createdGraphChart.data.datasets[0].data = inData
    createdGraphChart.data.datasets[1].data = outData
    createdGraphChart.update()
  }

  if (!createdTrendChart) {
    createdTrendChart = new Chart(graphTrend, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'cumulative glory',
          backgroundColor: "rgba(78,205,196,.33)",
          data: cumulativeGlory
        }, {
          label: 'gainz per month',
          backgroundColor: "rgba(196,77,88,.33)",
          data: trendData
        }]
      },
      options: {
        maintainAspectRatio: false
      }
    })
  } else {
    createdTrendChart.data.labels = labels;
    createdTrendChart.data.datasets[0].data = cumulativeGlory
    createdTrendChart.data.datasets[1].data = trendData
    createdTrendChart.update()
  }
}

function readCSV(path) {
  fs.readFile(path, 'utf8', function (err, buffData) {
    parse(buffData, { delimiter: ';', columns: true, auto_parse: true }, function(err, output) {
      allData = output.map(simplifyData)
      recalcCharts()
      drawCharts()
      document.getElementById('load').style.display = 'none'
      document.getElementById('chart').style.display = 'block'
    })
  })
}

document.querySelectorAll('.switchDataAmount .btn').forEach(function(elem) {
  elem.addEventListener('click', function(e) {
    monthsInPast = e.target.dataset.amount
    limitDate = moment().subtract(monthsInPast, 'months').startOf('month')

    recalcCharts()
    drawCharts()
    document.querySelectorAll('.switchDataAmount .btn').forEach((elem) => elem.classList.remove('active'))
    document.querySelectorAll(`.switchDataAmount .btn[data-amount="${monthsInPast}"]`).forEach((elem) => elem.classList.add('active'))
  })
})
