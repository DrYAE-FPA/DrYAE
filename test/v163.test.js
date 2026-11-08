const { _electron } = require('playwright'); const fs = require('fs');
(async () => {
  const HOME = '/tmp/claude-0/uihome-v163'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME, { recursive: true });
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: '/home/claude/dryae3', executablePath: '/home/claude/dryae3/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); w.on('pageerror', e => console.log('[uierr]', e.message)); await w.waitForTimeout(2000);
  for (const acc of ['#0078d4', null]) {
    await w.evaluate(a => { window.SYS_ACCENT = a; }, acc);
    await w.click('#setBtn'); await w.waitForTimeout(600);
    console.log('accent', acc, '-> ouvert :', await w.evaluate(() => !!document.querySelector('#sModal.on')));
    await w.keyboard.press('Escape'); await w.waitForTimeout(300);
  }
  await app.close(); process.exit(0);
})();
