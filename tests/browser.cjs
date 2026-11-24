const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

// 隔离浏览器上下文，不读取或改动用户浏览器中的配置。
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const key = 'hrone-city-rules-config-only-v1';
  const rows = page.locator('.ant-table-tbody tr[data-row-key]');
  const modal = page.locator('.rule-modal');
  const screenshotDir = path.join(__dirname, '../screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const chooseCountry = async name => {
    await page.locator('.rule-search .ant-select').nth(1).click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: name }).click();
  };
  const screenshot = async name => {
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
  };
  try {
    await page.goto(process.env.PROTOTYPE_URL || 'http://127.0.0.1:4173/index.html');
    await page.getByRole('heading', { name: '国家折算规则' }).waitFor();
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    assert.equal(await rows.count(), 2);
    assert.equal(await page.getByRole('button', { name: '规则说明', exact: true }).count(), 0);
    assert.equal(await page.locator('.ant-drawer').count(), 0);
    assert.equal(await page.locator('.ant-table-thead').innerText().then(text => text.includes('二级部门')), true);
    const headers = await page.locator('.ant-table-thead th').allTextContents();
    assert.deepEqual(headers, ['二级部门', '国家', '基准城市', '启用状态', '档位：系数', '操作']);
    assert.match(await rows.first().innerText(), /国家标准/);
    assert.equal(await rows.first().locator('.tier-summary').innerText(), 'A：1.00；B：0.90；C：0.80；D：0.70');
    const original = await page.evaluate(key => localStorage.getItem(key), key);
    await screenshot('optimized-list.png');

    await chooseCountry('法国');
    await page.getByRole('button', { name: '查询', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('tr[data-row-key]').length === 1);
    assert.match(await rows.innerText(), /法国/);
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('tr[data-row-key]').length === 2);
    await chooseCountry('英国');
    // 回车与查询按钮共用提交链路。
    await page.locator('.rule-search .ant-select').nth(1).locator('input').press('Tab');
    await page.locator('.rule-search button[type="submit"]').focus();
    await page.keyboard.press('Enter');
    await page.getByText('未找到符合条件的规则', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重置查询', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('tr[data-row-key]').length === 2);
    console.log('PASS 查询、回车、重置和查询空态');

    await page.getByRole('button', { name: '配置规则 · 德国', exact: true }).click();
    await page.setViewportSize({ width: 1280, height: 800 });
    await modal.waitFor();
    assert.equal(await modal.locator('.department-select input').isDisabled(), true, '编辑时二级部门不可修改');
    assert.equal(await modal.locator('.country-select input').isDisabled(), true, '编辑时国家不可修改');
    const disabledStyles = await modal.evaluate(element => ['.department-select', '.country-select'].map(selector => {
      const control = element.querySelector(selector + ' .ant-select-selector');
      const style = getComputedStyle(control);
      return { background: style.backgroundColor, color: getComputedStyle(control.querySelector('.ant-select-selection-item')).color, border: style.borderColor, height: control.getBoundingClientRect().height };
    }));
    assert.deepEqual(disabledStyles[0], disabledStyles[1], '部门与国家禁用样式应一致');
    assert.equal(await modal.locator('.country-select .ant-select-selection-item').innerText(), '德国 DE');
    await screenshot('optimized-editor.png');
    const bounds = await modal.evaluate(element => {
      const footer = element.querySelector('.ant-modal-footer').getBoundingClientRect();
      const body = element.querySelector('.ant-modal-body').getBoundingClientRect();
      return { bottom: footer.bottom, bodyTop: body.top, bodyBottom: body.bottom, viewport: innerHeight };
    });
    assert.ok(bounds.bottom <= bounds.viewport, '编辑底栏应在视口内');
    await modal.getByLabel('第1行档位名称', { exact: true }).fill('');
    await modal.getByRole('button', { name: /保\s*存/, exact: true }).click();
    await modal.getByText('请输入档位名称', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), '第1行档位名称');
    await modal.getByLabel('第1行档位名称', { exact: true }).fill('A');
    assert.equal(await modal.getByRole('button', { name: '规则说明', exact: true }).count(), 0);
    assert.equal(await page.locator('.ant-drawer').count(), 0);
    assert.equal(await modal.getByLabel('第1行档位名称', { exact: true }).inputValue(), 'A');
    await modal.getByRole('button', { name: /取\s*消/, exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), original);
    console.log('PASS 编辑布局、错误定位、隐藏规则说明与取消不保存');

    await page.getByRole('button', { name: '配置规则 · 德国', exact: true }).click();
    await modal.getByRole('button', { name: '删除第1行档位', exact: true }).click();
    const confirm = page.locator('.ant-modal-confirm');
    await confirm.getByText('将删除 A档位及其城市配置。', { exact: true }).waitFor();
    assert.equal(await confirm.locator('.ant-modal-confirm-title').count(), 0);
    await confirm.getByRole('button', { name: /取\s*消/, exact: true }).click();
    assert.equal(await modal.locator('.tier-table tbody tr').count(), 4);
    for (let row = 4; row > 1; row--) {
      await modal.getByRole('button', { name: '删除第' + row + '行档位', exact: true }).click();
      await confirm.getByRole('button', { name: /删\s*除/, exact: true }).click();
      await confirm.waitFor({ state: 'hidden' });
    }
    assert.equal(await modal.locator('.tier-table tbody tr').count(), 1);
    assert.equal(await modal.getByRole('button', { name: /删除第.*行档位/ }).count(), 0);
    await modal.getByRole('button', { name: '新增档位', exact: true }).click();
    assert.equal(await modal.getByRole('button', { name: /删除第.*行档位/ }).count(), 2);
    await modal.getByRole('button', { name: '删除第2行档位', exact: true }).click();
    assert.equal(await modal.locator('.tier-table tbody tr').count(), 1);
    assert.equal(await modal.getByRole('button', { name: /删除第.*行档位/ }).count(), 0);
    await modal.getByRole('button', { name: /取\s*消/, exact: true }).click();
    await page.getByRole('button', { name: '配置规则 · 德国', exact: true }).click();
    console.log('PASS 至少保留一个档位、隐藏删除与新增后恢复');
    for (let i = 0; i < 8; i++) await modal.getByRole('button', { name: '新增档位', exact: true }).click();
    await modal.getByRole('button', { name: /保\s*存/, exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), '第5行档位名称');
    const focused = await page.evaluate(() => {
      const field = document.activeElement.getBoundingClientRect();
      const body = document.querySelector('.rule-modal .ant-modal-body').getBoundingClientRect();
      return field.top >= body.top && field.bottom <= body.bottom;
    });
    assert.ok(focused, '长表单应定位到可见的首个错误字段');
    await modal.getByRole('button', { name: /取\s*消/, exact: true }).click();
    console.log('PASS 删除确认、长表单滚动与校验定位');

    await page.getByRole('button', { name: '配置规则 · 德国', exact: true }).click();
    await modal.getByLabel('第2行折算系数', { exact: true }).fill('0.95');
    await modal.getByRole('button', { name: /保\s*存/, exact: true }).click();
    await page.getByText('城市折算规则已保存', { exact: true }).waitFor();
    await modal.waitFor({ state: 'hidden' });
    const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), key));
    assert.equal(saved[JSON.stringify(['LBU速运事业部', 'DE'])].tiers[1].factor, 0.95);
    assert.deepEqual(saved[JSON.stringify(['LBU速运事业部', 'FR'])], JSON.parse(original)[JSON.stringify(['LBU速运事业部', 'FR'])]);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), [key]);
    await page.reload();
    await page.getByRole('button', { name: '配置规则 · 德国', exact: true }).click();
    assert.equal(await modal.getByLabel('第2行折算系数', { exact: true }).inputValue(), '0.95');
    await modal.getByRole('button', { name: /取\s*消/, exact: true }).click();
    console.log('PASS 保存、刷新回显与方案存储隔离');

    const table = page.locator('.ant-table-content');
    await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    const fixedVisible = await page.locator('tr[data-row-key]').first().evaluate(row => {
      const cells = [...row.querySelectorAll('td.ant-table-cell')];
      const box = row.closest('.ant-table-content').getBoundingClientRect();
      return [cells[0], cells[1], cells.at(-1)].every(cell => {
        const rect = cell.getBoundingClientRect();
        return rect.left >= box.left - 1 && rect.right <= box.right + 1;
      });
    });
    assert.ok(fixedVisible, '横向滚动后部门、国家、操作应保持可见');
    await page.getByRole('button', { name: '新增', exact: true }).click();
    assert.equal(await modal.locator('.department-select input').isDisabled(), false, '新增时仍可选择二级部门');
    assert.equal(await modal.locator('.country-select input').isDisabled(), false, '新增时仍可选择国家');
    assert.equal(await modal.getByRole('switch').getAttribute('aria-checked'), 'true', '新增方案默认已启用');
    assert.equal(await modal.getByRole('button', { name: /删除第.*行档位/ }).count(), 0, '新增时唯一空白档位也不允许删除');
    const tierName = modal.getByLabel('第1行档位名称', { exact: true });
    const tierFactor = modal.getByLabel('第1行折算系数', { exact: true });
    const tierCities = modal.locator('.tier-table .ant-select input').first();
    const addTier = modal.getByRole('button', { name: '新增档位', exact: true });
    for (const field of [tierName, tierFactor, tierCities, addTier]) assert.equal(await field.isDisabled(), true, '未选国家时档位相关控件统一禁用');
    await modal.getByText('请先选择国家，再配置档位、系数和城市。', { exact: true }).waitFor();
    await modal.getByRole('button', { name: /保\s*存/, exact: true }).click();
    await modal.locator('.field-error').filter({ hasText: '请选择国家' }).waitFor();
    assert.equal(await modal.locator('.tier-table .field-error').count(), 3, '未选国家时仅显示表头的必填星号，不展示档位错误');
    assert.equal(await modal.locator('.tier-table [class*="status-error"]').count(), 0);
    await modal.locator('.country-select').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: '英国' }).click();
    for (const field of [tierName, tierFactor, tierCities, addTier]) assert.equal(await field.isDisabled(), false, '选定国家后档位相关控件统一启用');
    assert.equal(await modal.getByText('请先选择国家，再配置档位、系数和城市。', { exact: true }).count(), 0);
    console.log('PASS 国家选择前后档位控件一致、前置提示及禁用字段不报错');
    await modal.locator('.base-city-field .ant-select').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: '伦敦' }).click();
    await modal.getByLabel('第1行档位名称', { exact: true }).fill('区域中心城市与重点国际业务城市');
    await modal.getByLabel('第1行折算系数', { exact: true }).fill('1.25');
    await modal.locator('.tier-table .ant-select').first().click();
    const tierListId = await modal.locator('.tier-table .ant-select input').first().getAttribute('aria-controls');
    const tierDropdown = page.locator('.ant-select-dropdown').filter({ has: page.locator('[id="' + tierListId + '"]') });
    await tierDropdown.locator('.ant-select-item-option').filter({ hasText: '伦敦' }).click();
    await modal.getByRole('heading', { name: '城市档位与折算系数' }).click();
    await page.evaluate(() => {
      window.originalStorageSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new Error('Test storage unavailable'); };
    });
    await modal.getByRole('button', { name: /保\s*存/, exact: true }).click();
    await page.getByText('浏览器无法保存配置', { exact: true }).waitFor();
    assert.equal(await modal.isVisible(), true);
    assert.equal(await rows.count(), 2);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSetItem; });
    await modal.getByRole('button', { name: /保\s*存/, exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await rows.count(), 3);
    const addedRow = rows.filter({ hasText: '英国' });
    assert.match(await addedRow.innerText(), /伦敦/);
    assert.equal(await addedRow.locator('.tier-summary').innerText(), '区域中心城市与重点国际业务城市：1.25');
    assert.match(await addedRow.innerText(), /已启用/);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key))[JSON.stringify(['LBU速运事业部', 'GB'])].enabled, key), true);
    assert.equal(await page.getByRole('button', { name: '删除方案 · 英国', exact: true }).isDisabled(), true);
    assert.equal(await page.locator('.ant-table-thead th').count(), 6, '不同档位名称不应生成新列');
    console.log('PASS 横向滚动、新增保存、失败恢复、基准城市与合并档位');

    assert.equal(await page.getByRole('button', { name: '删除方案 · 德国', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '删除方案 · 德国', exact: true }).locator('..').hover();
    await page.getByRole('tooltip', { name: '请先停用方案后再删除', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: '配置规则 · 英国', exact: true }).click();
    assert.equal(await modal.getByRole('switch').getAttribute('aria-checked'), 'true', '刷新后编辑保留已启用状态');
    await modal.getByRole('switch').click();
    await modal.getByRole('button', { name: /保\s*存/, exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.match(await addedRow.innerText(), /未启用/);
    const beforeDelete = await page.evaluate(key => localStorage.getItem(key), key);
    await page.getByRole('button', { name: '删除方案 · 英国', exact: true }).click();
    const deleteConfirm = page.locator('.ant-modal-confirm');
    const deleteText = '将删除“LBU速运事业部 / 英国”的全部城市折算规则。';
    await deleteConfirm.getByText(deleteText, { exact: true }).waitFor();
    assert.equal(await deleteConfirm.locator('.ant-modal-confirm-title').count(), 0);
    await deleteConfirm.getByRole('button', { name: /取\s*消/, exact: true }).click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), beforeDelete);
    await page.getByRole('button', { name: '删除方案 · 英国', exact: true }).click();
    await page.evaluate(() => {
      window.originalStorageSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new Error('Test storage unavailable'); };
    });
    await deleteConfirm.getByRole('button', { name: /删\s*除/, exact: true }).click();
    await page.getByText('删除失败：浏览器无法保存配置', { exact: true }).waitFor();
    assert.equal(await deleteConfirm.isVisible(), true);
    assert.equal(await rows.count(), 3);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), beforeDelete);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSetItem; });
    await deleteConfirm.getByRole('button', { name: /删\s*除/, exact: true }).click();
    await deleteConfirm.waitFor({ state: 'hidden' });
    await page.getByText('城市折算方案已删除', { exact: true }).waitFor();
    assert.equal(await rows.count(), 2);
    const afterDelete = JSON.parse(await page.evaluate(key => localStorage.getItem(key), key));
    const expected = JSON.parse(beforeDelete);
    delete expected[JSON.stringify(['LBU速运事业部', 'GB'])];
    assert.deepEqual(afterDelete, expected);
    await page.reload();
    await page.getByRole('button', { name: '新增', exact: true }).click();
    await modal.locator('.country-select').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: '英国' }).waitFor();
    await modal.getByRole('button', { name: /取\s*消/, exact: true }).click();
    console.log('PASS 启用方案禁删、精简确认文案、取消、失败重试、持久化与重新新增');

    // 用六个国家的独立测试配置复现末页仅剩一条的删除场景。
    await page.evaluate(key => {
      const rules = JSON.parse(localStorage.getItem(key));
      const department = 'LBU速运事业部';
      for (const [id, city] of [['GB', '伦敦'], ['ES', '马德里'], ['IT', '米兰'], ['NL', '阿姆斯特丹']]) {
        rules[JSON.stringify([department, id])] = { department, id, enabled: false, baseCity: '', tiers: [{ name: '核心', factor: 1, cities: [city] }] };
      }
      localStorage.setItem(key, JSON.stringify(rules));
      localStorage.setItem('other-scheme-test-marker', 'unchanged');
    }, key);
    await page.reload();
    await page.locator('.ant-pagination-next button').click();
    await page.getByRole('button', { name: '删除方案 · 荷兰', exact: true }).click();
    await deleteConfirm.getByRole('button', { name: /删\s*除/, exact: true }).click();
    await deleteConfirm.waitFor({ state: 'hidden' });
    assert.equal(await rows.count(), 5);
    assert.equal(await page.locator('.ant-pagination-item-active').innerText(), '1');
    await chooseCountry('英国');
    await page.getByRole('button', { name: '查询', exact: true }).click();
    await page.getByRole('button', { name: '删除方案 · 英国', exact: true }).click();
    await deleteConfirm.getByRole('button', { name: /删\s*除/, exact: true }).click();
    await page.getByText('未找到符合条件的规则', { exact: true }).waitFor();
    assert.equal(await page.locator('.rule-search .ant-select').nth(1).locator('.ant-select-selection-item').innerText(), '英国');
    await page.evaluate(key => {
      const department = 'LBU速运事业部';
      const id = 'NL';
      localStorage.setItem(key, JSON.stringify({ [JSON.stringify([department, id])]: { department, id, enabled: false, baseCity: '', tiers: [{ name: '核心', factor: 1, cities: ['阿姆斯特丹'] }] } }));
    }, key);
    await page.reload();
    await page.getByRole('button', { name: '删除方案 · 荷兰', exact: true }).click();
    await deleteConfirm.getByRole('button', { name: /删\s*除/, exact: true }).click();
    await page.getByText('暂无城市折算规则', { exact: true }).waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{}');
    await page.reload();
    await page.getByText('暂无城市折算规则', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('other-scheme-test-marker')), 'unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS 删除后分页回退、保留查询、删空刷新不恢复、其他存储不变及无JS异常');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
