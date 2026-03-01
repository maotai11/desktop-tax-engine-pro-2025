const Decimal = require('decimal.js');

function toAmount(value) {
  return new Decimal(value || 0);
}

function runCalculation(payload) {
  const moduleType = payload.moduleType;
  const year = Number(payload.year || 2025);
  const input = payload.input || {};

  switch (moduleType) {
    case 'corp_income': {
      const income = toAmount(input.revenue).minus(toAmount(input.cost)).minus(toAmount(input.expense)).plus(toAmount(input.nonOperatingIncome)).minus(toAmount(input.nonOperatingLoss));
      const taxable = Decimal.max(income, 0);
      const tax = taxable.mul(0.2).toDecimalPlaces(0);
      return {
        year,
        moduleType,
        summary: { taxableIncome: taxable.toNumber(), taxPayable: tax.toNumber() },
        steps: [
          `課稅所得額 = 收入 - 成本 - 費用 + 非營業收入 - 非營業損失 = ${taxable.toFixed(0)}`,
          `應納稅額 = 課稅所得額 x 20% = ${tax.toFixed(0)}`,
        ],
        legalBasis: ['所得稅法第24條'],
      };
    }
    case 'vat': {
      const outputTax = toAmount(input.outputSales).mul(0.05);
      const inputTax = toAmount(input.inputPurchases).mul(0.05);
      const payable = outputTax.minus(inputTax).toDecimalPlaces(0);
      return {
        year,
        moduleType,
        summary: { outputTax: outputTax.toNumber(), inputTax: inputTax.toNumber(), taxPayable: payable.toNumber() },
        steps: [
          `銷項稅額 = 銷售額 x 5% = ${outputTax.toFixed(0)}`,
          `進項稅額 = 進貨額 x 5% = ${inputTax.toFixed(0)}`,
          `應納稅額 = 銷項 - 進項 = ${payable.toFixed(0)}`,
        ],
        legalBasis: ['營業稅法第15條'],
      };
    }
    case 'personal_income': {
      const total = toAmount(input.totalIncome);
      const deduction = toAmount(input.deductions).plus(toAmount(input.exemptions));
      const taxable = Decimal.max(total.minus(deduction), 0);
      const tax = taxable.mul(0.1).toDecimalPlaces(0);
      return {
        year,
        moduleType,
        summary: { taxableIncome: taxable.toNumber(), taxPayable: tax.toNumber() },
        steps: [
          `課稅所得淨額 = 所得總額 - 扣除額 - 免稅額 = ${taxable.toFixed(0)}`,
          `簡化試算稅額 = 課稅所得淨額 x 10% = ${tax.toFixed(0)}`,
        ],
        legalBasis: ['所得稅法第71條'],
      };
    }
    case 'labor_nhi': {
      const salary = toAmount(input.salary);
      const labor = salary.mul(0.07);
      const nhi = salary.mul(0.0517);
      const pension = salary.mul(0.06);
      const totalCost = labor.plus(nhi).plus(pension).plus(salary).toDecimalPlaces(0);
      return {
        year,
        moduleType,
        summary: {
          laborEmployer: labor.toDecimalPlaces(0).toNumber(),
          nhiEmployer: nhi.toDecimalPlaces(0).toNumber(),
          pensionEmployer: pension.toDecimalPlaces(0).toNumber(),
          totalCost: totalCost.toNumber(),
        },
        steps: [
          `雇主勞保 = 薪資 x 7% = ${labor.toFixed(0)}`,
          `雇主健保 = 薪資 x 5.17% = ${nhi.toFixed(0)}`,
          `雇主勞退 = 薪資 x 6% = ${pension.toFixed(0)}`,
        ],
        legalBasis: ['勞保投保薪資分級相關規範', '勞工退休金條例'],
      };
    }
    case 'withholding': {
      const amount = toAmount(input.paymentAmount);
      const rate = toAmount(input.rate || 10).div(100);
      const withholding = amount.mul(rate).toDecimalPlaces(0);
      return {
        year,
        moduleType,
        summary: { paymentAmount: amount.toNumber(), withholdingRate: rate.mul(100).toNumber(), withholdingTax: withholding.toNumber() },
        steps: [
          `扣繳稅額 = 給付金額 x 稅率 = ${withholding.toFixed(0)}`,
        ],
        legalBasis: ['所得稅法第88條'],
      };
    }
    default:
      throw new Error(`Unsupported moduleType: ${moduleType}`);
  }
}

module.exports = { runCalculation };
