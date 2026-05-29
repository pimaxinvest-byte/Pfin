import puppeteer from 'puppeteer'

const BASE   = 'http://localhost:3000'
const sleep  = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

async function shot(page, path, filename) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 15000 })
  await sleep(900)
  await page.screenshot({ path: `/tmp/${filename}.png`, clip: { x:0, y:0, width:390, height:844 } })
  console.log(`✓ ${filename}`)
}

async function login(page, email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.$eval('input[type="email"]',    el => el.value = '')
  await page.$eval('input[type="password"]', el => el.value = '')
  await page.type('input[type="email"]',    email)
  await page.type('input[type="password"]', pass)
  await page.click('button[type="submit"]')
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => {})
  await sleep(1200)
}

const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

await shot(page, '/login',    '01_login')
await shot(page, '/register', '02_register')

await login(page, 'admin@gymbook.com', 'admin123')
await shot(page, '/admin',            '03_admin_dashboard')
await shot(page, '/admin/calendar',   '04_admin_calendar')
await shot(page, '/admin/users',      '05_admin_users')
await shot(page, '/admin/settings',   '06_admin_settings')

await login(page, 'juan@email.com', 'client123')
await shot(page, '/dashboard',             '07_client_home')
await shot(page, '/dashboard/book',        '08_client_book')
await shot(page, '/dashboard/teachers',    '09_teachers')
await shot(page, '/dashboard/my-bookings', '10_my_bookings')

await login(page, 'maria@gymbook.com', 'teacher123')
await shot(page, '/teacher',           '11_teacher_calendar')
await shot(page, '/teacher/recurring', '12_teacher_recurring')
await shot(page, '/teacher/bookings',  '13_teacher_bookings')

await browser.close()
console.log('\n🎉 Done — screenshots in /tmp/')
