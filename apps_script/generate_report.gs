var TEMPLATE_SPREADSHEET_ID='14P68SCjUZk129M77W9x95KO068zLzg4WnxklvU0nlSg';
function doPost(e){
  try{
    var payload=JSON.parse(e.postData.contents);
    var templateId=payload.templateId||TEMPLATE_SPREADSHEET_ID;
    if(!templateId)return ContentService.createTextOutput(JSON.stringify({error:'Missing templateId'})).setMimeType(ContentService.MimeType.JSON);
    var copy=DriveApp.getFileById(templateId).makeCopy('Reporte - '+(payload.title||new Date().toISOString()));
    var ss=SpreadsheetApp.openById(copy.getId());
    var sheet=ss.getSheets()[0];
    try{sheet.getRange('H5').setValue((payload.summary&&payload.summary.dayReportCellF5)||'');}catch(e){}
    try{sheet.getRange('H8').setValue((payload.summary&&payload.summary.dayTotalCellF8)||'');}catch(e){}
    var startRow=17;var values=[];(payload.rows||[]).forEach(function(r){
      var fechaVal = r.fecha || '';
      // try to convert YYYY-MM-DD to Date
      if(typeof fechaVal==='string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaVal)){
        fechaVal = new Date(fechaVal + 'T00:00:00');
      }
      values.push([fechaVal,r.empleado||'',r.consola||'',typeof r.dinero!=='undefined'?r.dinero:'',r.tiempo||'',r.inicio||'',r.fin||'',r.comentario||'']);
    });
    if(values.length>0)sheet.getRange(startRow,3,values.length,values[0].length).setValues(values);
    // apply formatting: date format for Fecha (col C), dinero as number (col F), comentario no-wrap (col J)
    try{
      if(values.length>0){
        sheet.getRange(startRow,3,values.length,1).setNumberFormat('dd/mm/yyyy');
        sheet.getRange(startRow,6,values.length,1).setNumberFormat('#,##0.00');
        sheet.getRange(startRow,10,values.length,1).setWrap(false);
      }
      // set reasonable column widths C..J
      sheet.setColumnWidth(3,100); // Fecha
      sheet.setColumnWidth(4,140); // Empleado
      sheet.setColumnWidth(5,140); // Consola
      sheet.setColumnWidth(6,100); // Dinero
      sheet.setColumnWidth(7,80);  // Tiempo
      sheet.setColumnWidth(8,80);  // Inicio
      sheet.setColumnWidth(9,80);  // Fin
      sheet.setColumnWidth(10,300); // Comentario
    }catch(e){}
    var totalsRow=startRow+values.length;sheet.getRange(totalsRow,2).setValue('Total');
    var totalUses=(payload.totals&&payload.totals.totalUses!=null)?payload.totals.totalUses:values.length;
    var totalMoney=(payload.totals&&payload.totals.totalMoney!=null)?payload.totals.totalMoney:values.reduce(function(a,b){return a+(Number(b[3])||0);},0);
  sheet.getRange(totalsRow,5).setValue(totalUses);sheet.getRange(totalsRow,6).setValue(totalMoney);
  try{sheet.getRange(totalsRow,5,1,2).setFontWeight('bold');sheet.getRange(totalsRow,6).setNumberFormat('#,##0.00');}catch(e){}
    try{sheet.autoResizeColumns(3,8);}catch(e){}
    var url='https://docs.google.com/spreadsheets/d/'+ss.getId()+'/export?format=xlsx';
    return ContentService.createTextOutput(JSON.stringify({ok:true,downloadUrl:url,fileId:ss.getId()})).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({error:String(err),stack:err&&err.stack?err.stack:null})).setMimeType(ContentService.MimeType.JSON);
  }
}
