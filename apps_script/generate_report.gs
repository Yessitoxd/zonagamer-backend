var TEMPLATE_SPREADSHEET_ID='14P68SCjUZk129M77W9x95KO068zLzg4WnxklvU0nlSg';
function doPost(e){
  try{
    var payload=JSON.parse(e.postData.contents);
    var templateId=payload.templateId||TEMPLATE_SPREADSHEET_ID;
    if(!templateId)return ContentService.createTextOutput(JSON.stringify({error:'Missing templateId'})).setMimeType(ContentService.MimeType.JSON);
  var copyName = payload.title ? payload.title : ('Reporte - ' + new Date().toISOString());
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
      var colDinero = values.map(function(r){return [r[3]];});
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
        sheet.getRange(startRow,3,values.length,1).setNumberFormat('dd/mm/yyyy');
        sheet.getRange(startRow,6,values.length,1).setNumberFormat('#,##0.00');
        sheet.getRange(startRow,10,values.length,1).setWrap(true);
  for(var i=0;i<values.length;i++){ try{ sheet.setRowHeight(startRow+i,60); }catch(er){} }
      }catch(e){}
    }
    try{
  sheet.setColumnWidth(3,220);
  sheet.setColumnWidth(4,220);
  sheet.setColumnWidth(5,160);
  sheet.setColumnWidth(6,140);
  sheet.setColumnWidth(7,120);
  sheet.setColumnWidth(8,120);
  sheet.setColumnWidth(9,120);
  sheet.setColumnWidth(10,600);
    }catch(e){}
    var totalsRow=startRow+values.length;
    // place 'Total' under Fecha column (C)
    sheet.getRange(totalsRow,3).setValue('Total');
    var totalUses=(payload.totals&&payload.totals.totalUses!=null)?payload.totals.totalUses:values.length;
    var totalMoney=(payload.totals&&payload.totals.totalMoney!=null)?payload.totals.totalMoney:values.reduce(function(a,b){return a+(Number(b[3])||0);},0);
    // total time minutes provided by frontend (optional)
    var totalTimeMin = (payload.totals && payload.totals.totalTimeMinutes != null) ? payload.totals.totalTimeMinutes : null;
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
