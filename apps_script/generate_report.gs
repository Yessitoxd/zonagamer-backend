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
    var startRow=17;var values=[];(payload.rows||[]).forEach(function(r){values.push([r.fecha||'',r.empleado||'',r.consola||'',typeof r.dinero!=='undefined'?r.dinero:'',r.tiempo||'',r.inicio||'',r.fin||'',r.comentario||'']);});
    if(values.length>0)sheet.getRange(startRow,3,values.length,values[0].length).setValues(values);
    var totalsRow=startRow+values.length;sheet.getRange(totalsRow,2).setValue('Total');
    var totalUses=(payload.totals&&payload.totals.totalUses!=null)?payload.totals.totalUses:values.length;
    var totalMoney=(payload.totals&&payload.totals.totalMoney!=null)?payload.totals.totalMoney:values.reduce(function(a,b){return a+(Number(b[3])||0);},0);
    sheet.getRange(totalsRow,5).setValue(totalUses);sheet.getRange(totalsRow,6).setValue(totalMoney);
    try{sheet.autoResizeColumns(3,8);}catch(e){}
    var url='https://docs.google.com/spreadsheets/d/'+ss.getId()+'/export?format=xlsx';
    return ContentService.createTextOutput(JSON.stringify({ok:true,downloadUrl:url,fileId:ss.getId()})).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({error:String(err),stack:err&&err.stack?err.stack:null})).setMimeType(ContentService.MimeType.JSON);
  }
}
