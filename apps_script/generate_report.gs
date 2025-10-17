var TEMPLATE_SPREADSHEET_ID='14P68SCjUZk129M77W9x95KO068zLzg4WnxklvU0nlSg';
function doPost(e){
  try{
    var payload=JSON.parse(e.postData.contents);
    var templateId=payload.templateId||TEMPLATE_SPREADSHEET_ID;
    if(!templateId)return ContentService.createTextOutput(JSON.stringify({error:'Missing templateId'})).setMimeType(ContentService.MimeType.JSON);
  var copyName = payload.title ? String(payload.title) : ('Reporte - ' + new Date().toISOString());
  // sanitize duplicate words like 'Reporte Reporte' -> 'Reporte'
  try{ copyName = copyName.replace(/(Reporte)\s+\1/gi,'$1'); }catch(e){}
  var copy=DriveApp.getFileById(templateId).makeCopy(copyName);
    var ss=SpreadsheetApp.openById(copy.getId());
    var sheet=ss.getSheets()[0];
    try{
      var h5 = (payload.summary&&payload.summary.dayReportCellF5) || '';
      if(typeof h5 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h5)){
        sheet.getRange('H5').setValue(new Date(h5+'T00:00:00'));
        sheet.getRange('H5').setNumberFormat('dd/mm/yyyy');
      } else {
        sheet.getRange('H5').setValue(h5);
      }
    }catch(e){}
    try{sheet.getRange('H8').setValue((payload.summary&&payload.summary.dayTotalCellF8)||'');}catch(e){}
    var startRow=17;var values=[];(payload.rows||[]).forEach(function(r){
      var fechaVal = r.fecha || '';
      // try to convert YYYY-MM-DD to Date
      if(typeof fechaVal==='string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaVal)){
        fechaVal = new Date(fechaVal + 'T00:00:00');
      }
      values.push([fechaVal,r.empleado||'',r.consola||'',typeof r.dinero!=='undefined'?r.dinero:'',r.tiempo||'',r.inicio||'',r.fin||'',r.comentario||'']);
    });
    if(values.length>0){
      var colFecha = values.map(function(r){
        var v = r[0];
        try{
          if(v instanceof Date){
            var dd = String(v.getDate()).padStart(2,'0');
            var mm = String(v.getMonth()+1).padStart(2,'0');
            var yy = v.getFullYear();
            return [dd+'/'+mm+'/'+yy];
          }
          if(typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v)){
            var parts = v.split('-'); return [parts[2]+'/'+parts[1]+'/'+parts[0]];
          }
        }catch(e){}
        return [v||''];
      });
      var colEmpleado = values.map(function(r){return [r[1]];});
      var colConsola = values.map(function(r){return [r[2]];});
      // Convert dinero to string with currency to avoid Excel showing #### if column too narrow
      var colDinero = values.map(function(r){
        try{ if(typeof r[3] === 'number') return ['C$ ' + Number(r[3]).toFixed(2)]; }catch(e){}
        return [r[3]];
      });
      var colTiempo = values.map(function(r){return [r[4]];});
      var colInicio = values.map(function(r){return [r[5]];});
      var colFin = values.map(function(r){return [r[6]];});
      var colComentario = values.map(function(r){return [r[7]];});
      sheet.getRange(startRow,3,values.length,1).setValues(colFecha);
      sheet.getRange(startRow,4,values.length,1).setValues(colEmpleado);
      sheet.getRange(startRow,5,values.length,1).setValues(colConsola);
      sheet.getRange(startRow,6,values.length,1).setValues(colDinero);
      sheet.getRange(startRow,7,values.length,1).setValues(colTiempo);
      sheet.getRange(startRow,8,values.length,1).setValues(colInicio);
      sheet.getRange(startRow,9,values.length,1).setValues(colFin);
      sheet.getRange(startRow,10,values.length,1).setValues(colComentario);
      try{
        // Fecha rows are already text in dd/mm/yyyy; ensure wrap and vertical align
        sheet.getRange(startRow,3,values.length,1).setWrap(true).setVerticalAlignment('top');
        // dinero written as text (C$ ...), but also set column to left align
        sheet.getRange(startRow,6,values.length,1).setHorizontalAlignment('right');
        sheet.getRange(startRow,10,values.length,1).setWrap(true).setVerticalAlignment('top');
        for(var i=0;i<values.length;i++){ try{ sheet.setRowHeight(startRow+i,66); }catch(er){} }
      }catch(e){}
    }
    try{
  // widen columns to reduce risk of '####' and truncation in Excel
  sheet.setColumnWidth(3,280); // Fecha
  sheet.setColumnWidth(4,220); // Empleado
  sheet.setColumnWidth(5,180); // Consola
  sheet.setColumnWidth(6,180); // Dinero
  sheet.setColumnWidth(7,140); // Tiempo
  sheet.setColumnWidth(8,140); // Inicio
  sheet.setColumnWidth(9,140); // Fin
  sheet.setColumnWidth(10,900); // Comentario
    }catch(e){}
    var totalsRow=startRow+values.length;
    // place 'Total' under Fecha column (C)
    sheet.getRange(totalsRow,3).setValue('Total');
    var totalUses=(payload.totals&&payload.totals.totalUses!=null)?payload.totals.totalUses:values.length;
    var totalMoney=(payload.totals&&payload.totals.totalMoney!=null)?payload.totals.totalMoney:values.reduce(function(a,b){return a+(Number(b[3])||0);},0);
    // total time minutes provided by frontend (optional)
    var totalTimeMin = (payload.totals && payload.totals.totalTimeMinutes != null) ? payload.totals.totalTimeMinutes : null;
    // if totalTimeMin is not provided, try to compute from rows (tiempo field) by attempting to parse numbers like '90 min' or '1 h 30 m'
    if(totalTimeMin == null){
      try{
        totalTimeMin = 0;
        for(var ri=0; ri<values.length; ri++){
          var t = values[ri][4];
          if(!t) continue;
          if(typeof t === 'number') { totalTimeMin += Math.round(t); continue; }
          var str = String(t).toLowerCase();
          var m = str.match(/(\d+)\s*min/);
          if(m) { totalTimeMin += parseInt(m[1],10); continue; }
          var mh = str.match(/(\d+)\s*h(?:oras?)?\s*(\d+)?/);
          if(mh){ var h = parseInt(mh[1],10); var mm = mh[2]?parseInt(mh[2],10):0; totalTimeMin += h*60 + mm; continue; }
        }
        if(totalTimeMin === 0) totalTimeMin = null;
      }catch(e){ totalTimeMin = null; }
    }
    // write totals: uses -> Consola (column E=5), money -> Dinero (F=6), time -> Tiempo (G=7)
    sheet.getRange(totalsRow,5).setValue(totalUses);
    sheet.getRange(totalsRow,6).setValue(totalMoney);
    try{sheet.getRange(totalsRow,5,1,2).setFontWeight('bold');sheet.getRange(totalsRow,6).setNumberFormat('#,##0.00');}catch(e){}
    if(totalTimeMin != null){
      var hrs = Math.floor(totalTimeMin/60); var mins = totalTimeMin % 60;
      var timeStr = (hrs>0? (hrs+' h '):'') + (mins>0? (mins+' min'):'');
      sheet.getRange(totalsRow,7).setValue(timeStr);
      try{ sheet.getRange(totalsRow,7).setFontWeight('bold'); }catch(e){}
    }
  // avoid auto-resizing columns because it may shrink date column and produce "#####" in Excel
    var url='https://docs.google.com/spreadsheets/d/'+ss.getId()+'/export?format=xlsx';
    return ContentService.createTextOutput(JSON.stringify({ok:true,downloadUrl:url,fileId:ss.getId()})).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({error:String(err),stack:err&&err.stack?err.stack:null})).setMimeType(ContentService.MimeType.JSON);
  }
}
