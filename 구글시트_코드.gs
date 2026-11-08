/**
 * 머루반 역사 탐험대 — 학생 결과 수집기 (Google Apps Script)
 * 횡계초등학교 5학년 머루반 · 사회 5-2 1단원
 *
 * 1) 결과를 모을 구글 시트를 새로 만들고
 * 2) 확장 프로그램 → Apps Script 에 이 코드를 통째로 붙여 넣어 저장한 뒤
 * 3) 배포 → 새 배포 → 유형: 웹 앱 (실행: 나 / 액세스 권한: 모든 사용자) 으로 배포하면
 *    https://script.google.com/macros/s/…/exec 주소가 나옵니다. 그 주소를 선생님 화면에 붙여 넣으세요.
 */
const SHEET_NAME = '머루반 결과';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // 열 제목 준비 (처음 보는 항목은 오른쪽에 새 열로 추가)
    const headers = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(String) : [];
    ['마지막 저장'].concat(Object.keys(data)).forEach(function (k) {
      if (headers.indexOf(k) < 0) headers.push(k);
    });
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#efe6fb');
    sh.setFrozenRows(1);

    // 같은 학생(같은 기기ID)이면 그 줄을 고쳐 쓰고, 처음이면 새 줄
    const idCol = headers.indexOf('기기ID') + 1;
    let row = 0;
    if (idCol && sh.getLastRow() > 1) {
      const ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; });
      const i = ids.indexOf(data['기기ID']);
      if (i >= 0) row = i + 2;
    }
    if (!row) row = sh.getLastRow() + 1;

    data['마지막 저장'] = new Date();
    const values = headers.map(function (h) { return clean(data[h]); });
    sh.getRange(row, 1, 1, headers.length).setValues([values]);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

// 주소를 브라우저에서 직접 열면 작동 확인 문구가 보입니다
function doGet() {
  return ContentService.createTextOutput('머루반 역사 탐험대 결과 수집기가 잘 작동하고 있어요.');
}

// 학생이 쓴 글이 수식(=, +, -, @)으로 시작하면 글자로 저장
function clean(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}
