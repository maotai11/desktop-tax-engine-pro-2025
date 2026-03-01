const axios = require('axios');

const API_BASE = 'https://data.gcis.nat.gov.tw/od/data/api';
const API_IDS = {
  checkType: '673F0FC0-B3A7-429F-9041-E9866836B66D',
  companyBasic: '5F64D864-61CB-4D0D-8AD9-492047CC1EA6',
  companyItems: '236EE382-4942-41A9-BD03-CA0709025E7C',
  businessFull: '426D5542-5F05-43EB-83F9-F1300F14E1F1',
  businessBasicByAgency: '7E6AFA72-AD6A-46D3-8681-ED77951D912D',
};

function formatRocDate(raw) {
  const s = String(raw || '').trim();
  if (!/^\d{7}$/.test(s)) return s;
  const y = Number(s.slice(0, 3)) + 1911;
  const m = s.slice(3, 5);
  const d = s.slice(5, 7);
  return `${y}-${m}-${d}`;
}

async function fetchApi(apiId, filter) {
  const url = `${API_BASE}/${apiId}`;
  const res = await axios.get(url, {
    timeout: 15000,
    params: {
      $format: 'json',
      $filter: filter,
      $skip: 0,
      $top: 5,
    },
  });

  return Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
}

function normalizeCompany(basic, itemsRow) {
  const items = (itemsRow?.Cmp_Business || []).map((x) => ({
    seqNo: x.Business_Seq_NO || x.Business_Seq_No || '',
    itemCode: x.Business_Item || '',
    itemDesc: x.Business_Item_Desc || '',
  }));

  return {
    entityType: 'company',
    entityName: basic.Company_Name || '',
    statusDesc: basic.Company_Status_Desc || '',
    responsibleName: basic.Responsible_Name || '',
    address: basic.Company_Location || '',
    authorityDesc: basic.Register_Organization_Desc || '',
    setupDate: formatRocDate(basic.Company_Setup_Date),
    latestChangeDate: formatRocDate(basic.Change_Of_Approval_Data),
    businessItems: items,
  };
}

function normalizeBusiness(row) {
  const items = (row?.Business_Item_Old || []).map((x) => ({
    seqNo: x.Business_Seq_NO || x.Business_Seq_No || '',
    itemCode: x.Business_Item || '',
    itemDesc: x.Business_Item_Desc || '',
  }));

  return {
    entityType: 'business',
    entityName: row.Business_Name || '',
    statusDesc: row.Business_Current_Status_Desc || '',
    responsibleName: row.Responsible_Name || row.Business_Director?.[0]?.Name || '',
    address: row.Business_Address || '',
    authorityDesc: row.Agency_Desc || '',
    setupDate: formatRocDate(row.Business_Setup_Approve_Date),
    latestChangeDate: formatRocDate(row.Business_Last_Change_Date || row.Business_Setup_Approve_Date),
    businessItems: items,
  };
}

async function lookupRegistryByTaxId(taxId) {
  const cleaned = String(taxId || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cleaned)) throw new Error('統編格式錯誤，需為 8 碼數字');

  const checkRows = await fetchApi(API_IDS.checkType, `NO eq ${cleaned}`);
  const map = new Map(checkRows.map((r) => [r.TYPE, r.exist]));

  if (map.get('公司') === 'Y' || checkRows.length === 0) {
    const [basic] = await fetchApi(API_IDS.companyBasic, `Business_Accounting_NO eq ${cleaned}`);
    if (basic) {
      const [itemsRow] = await fetchApi(API_IDS.companyItems, `Business_Accounting_NO eq ${cleaned}`);
      const profile = normalizeCompany(basic, itemsRow);
      return {
        taxId: cleaned,
        ...profile,
        raw: {
          checkRows,
          companyBasic: basic,
          companyItems: itemsRow || null,
        },
        source: 'remote',
      };
    }
  }

  if (map.get('商業') === 'Y' || checkRows.length === 0) {
    const [business] = await fetchApi(API_IDS.businessFull, `President_No eq ${cleaned}`);
    if (business) {
      let businessDetail = null;
      if (business.Agency) {
        [businessDetail] = await fetchApi(API_IDS.businessBasicByAgency, `President_No eq ${cleaned} and Agency eq ${business.Agency}`);
      }
      const profile = normalizeBusiness({ ...business, ...(businessDetail || {}) });
      return {
        taxId: cleaned,
        ...profile,
        raw: {
          checkRows,
          business,
          businessDetail,
        },
        source: 'remote',
      };
    }
  }

  throw new Error('查無公司或商業登記資料');
}

module.exports = {
  lookupRegistryByTaxId,
};
