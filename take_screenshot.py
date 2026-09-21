import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1440, 'height': 960})
        page = await context.new_page()
        
        await page.route("**/*google*", lambda route: route.abort())
        await page.route("**/*gstatic*", lambda route: route.abort())
        
        await page.goto("http://127.0.0.1:8766/?v=2", wait_until="commit")
        await page.wait_for_timeout(1000)
        
        radar_btn = page.locator("button[data-view='radar']")
        if await radar_btn.count() > 0:
            await radar_btn.first.click()
            await page.wait_for_timeout(800)

        # Close any modal if open to show cards clearly
        close_btn = page.locator("button:has-text('×'), .modal-close, button:has-text('✕')")
        if await close_btn.count() > 0:
            await close_btn.first.click()
            await page.wait_for_timeout(500)
            
        artifact_path = "/Users/albert/.gemini/antigravity/brain/f5a75047-65db-44e1-93da-eecb5de74890/policy_radar_verified_preview.png"
        pack_path = "/Users/albert/Documents/project/output/park-roster-pack/images/policy_radar_verified_live.png"
        
        await page.screenshot(path=artifact_path, full_page=False, timeout=5000)
        await page.screenshot(path=pack_path, full_page=False, timeout=5000)
        print("✓ Clear screenshot captured successfully!")
        await browser.close()

asyncio.run(main())
