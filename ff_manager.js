
        /* All data is in "data" (data.vehicles, data.refuels, data.expenses). update() saves it, renderAll() redraws. "x => x.id === id" = function (x) { return x.id === id; } */
    /* ---------- 1. SETTINGS AND HELPERS ---------- */
    const STORAGE_KEY = 'fleetFuelSimple1';
    const PRICE = 377;                 // default fuel price, Rs per litre
    let randomSeed = 7;                // makes the same demo numbers every time
    let data = loadData();
    function byId(id) { return document.getElementById(id); }
    function num(n, d = 0) { return Number(n).toLocaleString('en-PK', { minimumFractionDigits: d, maximumFractionDigits: d }); }
    function safe(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function getVehicle(id) { return data.vehicles.find(v => v.id === id) || { reg: '?', model: '' }; }
    function sumOf(list, field) { return list.reduce((total, item) => total + item[field], 0); }   // adds one field of a list
    function table(headings, rows) {   // builds an HTML table from a list of rows
      return '<table><tr><th>' + headings.join('</th><th>') + '</th></tr>' + rows.map(r => '<tr><td>' + r.join('</td><td>') + '</td></tr>').join('') + '</table>';
    }
    function update() {                // save in the browser, then draw everything again
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) { }
      renderAll();
    }
    /* ---------- 2. LOAD AND DEMO DATA ---------- */
    function loadData() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || demoData(); } catch (error) { return demoData(); } }
    function random() {                // gives the same "random" numbers in the same order
      randomSeed = (randomSeed * 16807) % 2147483647; return randomSeed / 2147483647;
    }
    function demoData() {              // 5 vehicles, 12 refuelling records each, 2 expenses each
      const demo = { vehicles: [], refuels: [], expenses: [] };
      const cars = [                   // registration, model, type, fuel, km per litre, start odometer
        ['KHI-AB-1234', 'Suzuki Alto', 'Hatchback', 'Petrol', 17, 18000],
        ['KHI-BC-5521', 'Suzuki Cultus', 'Hatchback', 'Petrol', 14, 32000],
        ['KHI-CD-7788', 'Honda City', 'Sedan', 'Petrol', 12.5, 41000],
        ['KHI-DE-9012', 'Toyota Corolla', 'Sedan', 'Petrol', 11, 56000],
        ['KHI-EF-3456', 'Toyota Hilux', 'Pickup', 'Diesel', 8.5, 74000]
      ];
      cars.forEach((car, i) => {
        const id = 'v' + (i + 1);
        let odometer = car[5];
        const date = new Date(2025, 10, 3 + i * 2, 12);              // first fill: November 2025
        demo.vehicles.push({ id: id, reg: car[0], model: car[1], type: car[2], fuel: car[3], notes: '', active: true });
        for (let k = 0; k < 12; k++) {
          const km = (k === 0) ? 0 : Math.round(330 + random() * 260);
          const litres = Number(((k === 0) ? 35 + random() * 10 : km / car[4] * (0.93 + random() * 0.14)).toFixed(2));
          odometer += km;
          demo.refuels.push({ id: id + 'r' + k, vehicleId: id, dateTime: date.toISOString().slice(0, 10) + 'T09:30', odometer: odometer,
                              litres: litres, price: PRICE, total: Math.round(litres * PRICE), fullTank: true });
          date.setDate(date.getDate() + 27 + Math.floor(random() * 8));   // next fill after 27-34 days
        }
        demo.expenses.push({ id: id + 'e1', vehicleId: id, date: '2026-03-15', category: 'Maintenance', amount: Math.round(6000 + random() * 9000), notes: 'Oil change & service' });
        demo.expenses.push({ id: id + 'e2', vehicleId: id, date: '2026-07-10', category: 'Tyres', amount: Math.round(18000 + random() * 30000), notes: 'Tyre replacement' });
      });
      return demo;
    }
    /* ---------- 3. CALCULATIONS (raw records -> useful information) ----------
       Fuel economy = "full tank to full tank" method: km since the last FULL tank / litres bought since then.
       The first record of a vehicle has no earlier odometer, so its distance and km/L stay empty (N/A). */
    function calculateRefuels() {
      const result = [];
      data.vehicles.forEach(vehicle => {
        const records = data.refuels.filter(r => r.vehicleId === vehicle.id);
        records.sort((a, b) => a.dateTime.localeCompare(b.dateTime) || a.odometer - b.odometer);   // oldest first
        let previous = null, lastFull = null;      // the record before this one, odometer at the last full tank
        let litresSince = 0, costSince = 0;        // litres bought and money spent since the last full tank
        records.forEach(record => {
          const row = Object.assign({}, record, { distance: null, tripKm: null, tripLitres: null, economy: null, costPerKm: null });
          if (previous) row.distance = record.odometer - previous.odometer;
          if (lastFull !== null) litresSince += record.litres;
          if (lastFull !== null) costSince += record.total;
          if (record.fullTank) {
            if (lastFull !== null && record.odometer > lastFull) {
              row.tripKm = record.odometer - lastFull;
              row.tripLitres = litresSince;
              row.economy = row.tripKm / litresSince;
              row.costPerKm = costSince / row.tripKm;
            }
            lastFull = record.odometer;            // start counting again from this full tank
            litresSince = 0;
            costSince = 0;
          }
          previous = record;
          result.push(row);
        });
      });
      return result;
    }
    function passesFilter(item) {      // true if a record should be shown with the current filters
      const day = (item.dateTime || item.date).slice(0, 10);
      if (byId('filterVehicle').value && item.vehicleId !== byId('filterVehicle').value) return false;
      if (byId('filterFrom').value && day < byId('filterFrom').value) return false;
      if (byId('filterTo').value && day > byId('filterTo').value) return false;
      return true;
    }
    /* ---------- 4. DRAWING THE SCREENS ---------- */
    function renderAll() {
      const active = data.vehicles.filter(v => v.active);
      [['filterVehicle', data.vehicles, '<option value="">All vehicles</option>'], ['refuelVehicle', active, ''], ['expenseVehicle', active, '']].forEach(item => {
        const select = byId(item[0]);
        const oldValue = select.value;
        select.innerHTML = item[2] + item[1].map(v => '<option value="' + v.id + '">' + safe(v.reg) + ' - ' + safe(v.model) + '</option>').join('');
        select.value = oldValue;
      });
      showDashboard();
      showLists();
      document.querySelectorAll('.date-wrap').forEach(wrap => wrap.classList.toggle('empty', wrap.querySelector('input').value === ''));   // "Select date" text
    }
    function showDashboard() {
      const rows = calculateRefuels().filter(passesFilter);
      const totals = {};               // numbers of each vehicle, added up
      rows.forEach(row => {
        if (!totals[row.vehicleId]) totals[row.vehicleId] = { id: row.vehicleId, count: 0, litres: 0, cost: 0, km: 0, tripLitres: 0, tripCost: 0 };
        const sum = totals[row.vehicleId];
        sum.count += 1;
        sum.litres += row.litres;
        sum.cost += row.total;
        if (row.tripKm) {
          sum.km += row.tripKm;
          sum.tripLitres += row.tripLitres;
          sum.tripCost += row.costPerKm * row.tripKm;
        }
      });
      const list = Object.values(totals);
      const ranked = list.filter(sum => sum.tripLitres > 0).sort((a, b) => b.km / b.tripLitres - a.km / a.tripLitres);   // best first
      const best = ranked[0], worst = ranked[ranked.length - 1];
      const top = list.slice().sort((a, b) => b.litres - a.litres)[0];
      const km = sumOf(list, 'km');
      const name = (sum, text) => sum ? getVehicle(sum.id).reg + ' (' + text + ')' : '-';
      const boxes = [                  // the 8 summary boxes: [title, value]
        ['Total km served', num(km) + ' km'],
        ['Total fuel consumed', num(sumOf(list, 'litres'), 2) + ' L'],
        ['Total fuel expenditure', 'Rs ' + num(sumOf(list, 'cost'))],
        ['Overall cost / km', km ? 'Rs ' + num(sumOf(list, 'tripCost') / km, 2) : '-'],
        ['Most economical', best ? name(best, num(best.km / best.tripLitres, 2) + ' km/L') : '-'],
        ['Least economical', worst ? name(worst, num(worst.km / worst.tripLitres, 2) + ' km/L') : '-'],
        ['Highest fuel consumer', top ? name(top, num(top.litres, 2) + ' L') : '-'],
        ['Other expenses', 'Rs ' + num(sumOf(data.expenses.filter(passesFilter), 'amount'))]
      ];
      byId('kpiBox').innerHTML = boxes.map(b => '<div class="kpi"><small>' + b[0] + '</small><b>' + safe(b[1]) + '</b></div>').join('');
      byId('summaryTable').innerHTML = table(['Vehicle', 'Refuels', 'Litres', 'Fuel cost', 'Valid km', 'km/L', 'Rs/km'],
        list.map(sum => [safe(getVehicle(sum.id).reg + ' ' + getVehicle(sum.id).model), sum.count, num(sum.litres, 2), 'Rs ' + num(sum.cost), num(sum.km),
                         sum.tripLitres ? num(sum.km / sum.tripLitres, 2) : 'N/A', sum.km ? num(sum.tripCost / sum.km, 2) : 'N/A']));
      drawChart('chartEconomy', 'bar', ranked.map(sum => getVehicle(sum.id).reg.replace('KHI-', '')), ranked.map(sum => Number((sum.km / sum.tripLitres).toFixed(2))), '#4f46e5');
      const months = {};               // for example { "2026-03": 70000 }
      rows.forEach(row => months[row.dateTime.slice(0, 7)] = (months[row.dateTime.slice(0, 7)] || 0) + row.total);
      const names = Object.keys(months).sort();
      drawChart('chartTrend', 'line', names, names.map(n => months[n]), '#f43f5e');
    }
    function drawChart(canvasId, type, labels, values, color) {   // draws a bar or line chart by hand on a <canvas>; "pen" is the drawing tool
      const canvas = byId(canvasId);
      canvas.width = Math.max(260, canvas.parentElement.clientWidth - 32);
      const pen = canvas.getContext('2d');
      pen.font = '12px system-ui, sans-serif';
      if (values.length === 0) return pen.fillText('No data', 10, 20);
      const left = 55, top = 16, width = canvas.width - left - 14, height = 204;      // the drawing area
      const maxValue = Math.max(...values) * 1.1, slot = width / values.length;       // slot = space for one bar / point
      const points = values.map((value, i) => ({ x: left + slot * i + slot / 2, y: top + height - height * value / maxValue }));
      pen.textAlign = 'right';
      pen.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {                                                  // grey lines with numbers on the left
        pen.fillStyle = '#dcdff7';
        pen.fillRect(left, top + height - height * i / 4, width, 1);
        pen.fillStyle = '#5b5a8a';
        pen.fillText(num(maxValue * i / 4, maxValue < 50 ? 1 : 0), left - 6, top + height - height * i / 4);
      }
      pen.fillStyle = color;
      pen.strokeStyle = color;
      pen.lineWidth = 2.5;
      pen.beginPath();
      points.forEach((p, i) => {                                                      // the bars, or the line
        if (type === 'bar') pen.fillRect(p.x - Math.min(slot * 0.3, 30), p.y, Math.min(slot * 0.6, 60), top + height - p.y);
        else if (i === 0) pen.moveTo(p.x, p.y);
        else pen.lineTo(p.x, p.y);
      });
      pen.stroke();
      pen.textAlign = 'center';
      points.forEach((p, i) => {                                                      // value above bars, dots on the line, names below
        pen.fillStyle = color;
        if (type === 'line') { pen.beginPath(); pen.arc(p.x, p.y, 3.5, 0, 7); pen.fill(); }
        pen.fillStyle = '#5b5a8a';
        pen.textBaseline = 'bottom';
        if (type === 'bar') pen.fillText(values[i], p.x, p.y - 3);
        pen.textBaseline = 'top';
        if (i % Math.ceil(values.length / 8) === 0) pen.fillText(labels[i], p.x, top + height + 8);
      });
    }
    function showLists() {             // the three tables: vehicles, refuelling records, expenses
      byId('vehicleList').innerHTML = table(['Reg / ID', 'Make / model', 'Type', 'Fuel', 'Notes', 'Status', ''],
        data.vehicles.map(v => [safe(v.reg), safe(v.model), v.type, v.fuel, safe(v.notes), v.active ? 'Active' : '<span class="bad">Deactivated</span>',
          '<button onclick="editVehicle(\'' + v.id + '\')">Edit</button> <button onclick="toggleVehicle(\'' + v.id + '\')">' + (v.active ? 'Deactivate' : 'Reactivate') + '</button>']));
      const rows = calculateRefuels().filter(passesFilter).sort((a, b) => b.dateTime.localeCompare(a.dateTime));   // newest first
      byId('refuelList').innerHTML = table(['Date', 'Vehicle', 'Odometer', 'Distance', 'Litres', 'Price', 'Calc. total', 'Receipt', 'km/L', 'Rs/km', ''],
        rows.map(row => {
          const calculated = row.litres * row.price;
          const wrong = Math.abs(calculated - row.total) > calculated * 0.01;        // receipt differs from litres x price
          return [row.dateTime.replace('T', ' '), safe(getVehicle(row.vehicleId).reg), num(row.odometer), row.distance === null ? 'N/A' : num(row.distance),
            num(row.litres, 2) + (row.fullTank ? '' : ' (part)'), num(row.price, 2), num(calculated), wrong ? '<span class="bad">' + num(row.total) + '</span>' : num(row.total),
            row.economy !== null ? num(row.economy, 2) : (row.distance === null ? 'N/A (first)' : '-'), row.costPerKm !== null ? num(row.costPerKm, 2) : '-',
            '<button onclick="deleteItem(\'refuels\', \'' + row.id + '\')">Delete</button>'];
        }));
      const expenses = data.expenses.filter(passesFilter).sort((a, b) => b.date.localeCompare(a.date));
      byId('expenseList').innerHTML = table(['Date', 'Vehicle', 'Category', 'Amount', 'Notes', ''],
        expenses.map(e => [e.date, safe(getVehicle(e.vehicleId).reg), e.category, 'Rs ' + num(e.amount), safe(e.notes),
          '<button onclick="deleteItem(\'expenses\', \'' + e.id + '\')">Delete</button>'])) + '<p><b>Total: Rs ' + num(sumOf(expenses, 'amount')) + '</b></p>';
    }
    function deleteItem(listName, id) {   // deletes one record from data.refuels or data.expenses
      if (confirm('Delete this record?')) data[listName] = data[listName].filter(item => item.id !== id);
      update();
    }
    /* ---------- 5. VEHICLES: add, edit, deactivate ---------- */
    byId('vehicleForm').onsubmit = function (event) {
      event.preventDefault();                        // stop the page from reloading
      const id = byId('vehicleId').value;            // empty when adding a new vehicle
      const reg = byId('vehicleReg').value.trim();
      if (data.vehicles.find(v => v.reg.toLowerCase() === reg.toLowerCase() && v.id !== id)) return alert('A vehicle with this registration already exists.');
      const details = { reg: reg, model: byId('vehicleModel').value.trim(), type: byId('vehicleType').value, fuel: byId('vehicleFuel').value, notes: byId('vehicleNotes').value.trim() };
      if (id) Object.assign(getVehicle(id), details);                                                // editing
      else data.vehicles.push(Object.assign({ id: 'v' + Date.now(), active: true }, details));       // adding
      byId('vehicleCancel').click();                 // clears the form
      update();
    };
    byId('vehicleCancel').onclick = function () {
      byId('vehicleForm').reset();
      byId('vehicleId').value = '';
      byId('vehicleTitle').textContent = 'Add vehicle';
    };
    function editVehicle(id) {         // puts a vehicle's details back in the form
      const v = getVehicle(id);
      byId('vehicleId').value = id;
      ['Reg', 'Model', 'Type', 'Fuel', 'Notes'].forEach(field => byId('vehicle' + field).value = v[field.toLowerCase()]);
      byId('vehicleTitle').textContent = 'Edit vehicle';
    }
    function toggleVehicle(id) { getVehicle(id).active = !getVehicle(id).active; update(); }      // Active <-> Deactivated (history is kept)
    /* ---------- 6. REFUELLING: add with checks ---------- */
    let receiptTyped = false;          // the receipt total fills itself (litres x price) until the user types their own
    byId('refuelTotal').oninput = () => receiptTyped = true;
    byId('refuelLitres').oninput = byId('refuelPrice').oninput = function () {
      const calculated = Math.round(byId('refuelLitres').value * byId('refuelPrice').value);
      byId('refuelCalc').textContent = calculated ? 'Calculated: Rs ' + num(calculated) : '';
      if (!receiptTyped) byId('refuelTotal').value = calculated || '';
    };
    byId('refuelForm').onsubmit = function (event) {
      event.preventDefault();
      const vehicleId = byId('refuelVehicle').value, dateTime = byId('refuelDate').value;
      const odometer = Number(byId('refuelOdo').value), litres = Number(byId('refuelLitres').value), price = Number(byId('refuelPrice').value);
      const calculated = Math.round(litres * price);
      const total = byId('refuelTotal').value === '' ? calculated : Number(byId('refuelTotal').value);
      // CHECK 1 and 2: numbers must be positive, date cannot be in the future
      if (litres <= 0 || price <= 0 || odometer <= 0 || total <= 0) return alert('Litres, price, odometer and amount must be positive.');
      if (new Date(dateTime) > new Date()) return alert('Refuelling date cannot be in the future.');
      const mine = data.refuels.filter(r => r.vehicleId === vehicleId).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
      const before = mine.filter(r => r.dateTime <= dateTime).pop(), after = mine.filter(r => r.dateTime > dateTime)[0];
      // CHECK 3 and 4: odometer must fit between the earlier and later readings
      if (before && odometer <= before.odometer && !confirm('Suspicious: odometer ' + odometer + ' is not higher than the previous reading (' + before.odometer + '). Save anyway?')) return;
      if (after && odometer >= after.odometer && !confirm('Suspicious: odometer ' + odometer + ' is not lower than the next reading (' + after.odometer + '). Save anyway?')) return;
      // CHECK 5: receipt amount should match litres x price (1% difference allowed)
      if (Math.abs(total - calculated) > calculated * 0.01 && !confirm('Receipt Rs ' + num(total) + ' differs from calculated Rs ' + num(calculated) + '. Keep the receipt amount?')) return;
      data.refuels.push({ id: 'r' + Date.now(), vehicleId: vehicleId, dateTime: dateTime, odometer: odometer, litres: litres, price: price, total: total, fullTank: byId('refuelFull').value === 'yes' });
      byId('refuelLitres').value = byId('refuelOdo').value = byId('refuelTotal').value = byId('refuelCalc').textContent = '';   // clear for the next entry
      receiptTyped = false;
      update();
    };
    byId('expenseForm').onsubmit = function (event) {
      event.preventDefault();
      data.expenses.push({ id: 'e' + Date.now(), vehicleId: byId('expenseVehicle').value, date: byId('expenseDate').value, category: byId('expenseCategory').value,
                           amount: Number(byId('expenseAmount').value), notes: byId('expenseNotes').value.trim() });
      byId('expenseAmount').value = byId('expenseNotes').value = '';
      update();
    };
    /* ---------- 7. EXPENSES AND EXPORT TO CSV (opens in Excel) ---------- */
    function downloadCsv(headings, rows, filename) {        // rows = list of lists
      const text = [headings].concat(rows).map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      link.download = filename;
      link.click();
    }
    byId('exportRefuels').onclick = function () {
      const rows = calculateRefuels().filter(passesFilter).map(r => [r.dateTime, getVehicle(r.vehicleId).reg, r.odometer, r.distance === null ? 'N/A' : r.distance,
        r.litres, r.price, Math.round(r.litres * r.price), r.total, r.fullTank ? 'Yes' : 'No', r.economy === null ? 'N/A' : num(r.economy, 2), r.costPerKm === null ? 'N/A' : num(r.costPerKm, 2)]);
      downloadCsv(['Date', 'Vehicle', 'Odometer', 'Distance km', 'Litres', 'Price/L', 'Calculated total', 'Receipt total', 'Full tank', 'km/L', 'Rs/km'], rows, 'refuels.csv');
    };
    byId('exportExpenses').onclick = () => downloadCsv(['Date', 'Vehicle', 'Category', 'Amount', 'Notes'],
      data.expenses.filter(passesFilter).map(e => [e.date, getVehicle(e.vehicleId).reg, e.category, e.amount, e.notes]), 'expenses.csv');
    /* ---------- 8. MENU, FILTERS AND START ---------- */
    const menuButtons = document.querySelectorAll('nav button');
    menuButtons.forEach(button => button.onclick = function () {      // show the chosen screen, hide the others
      menuButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      button.classList.add('active');
      byId(button.dataset.tab).classList.add('active');
      renderAll();                     // so the charts get the right size
    });
    byId('filterVehicle').onchange = byId('filterFrom').onchange = byId('filterTo').onchange = renderAll;
    document.querySelectorAll('.date-wrap input').forEach(input => input.oninput = renderAll);
    byId('clearFilters').onclick = () => { byId('filterVehicle').value = byId('filterFrom').value = byId('filterTo').value = ''; renderAll(); };
    byId('printBtn').onclick = () => window.print();
    byId('resetDemo').onclick = function () {
      if (!confirm('Replace all data with the demo data?')) return;
      randomSeed = 7;
      data = demoData();
      update();
    };
    window.addEventListener('resize', showDashboard);                 // redraw the charts when the window size changes
    renderAll();                                                      // START: draw everything for the first time
    