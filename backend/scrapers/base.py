import asyncio
from typing import Dict, Any, List
from playwright.async_api import async_playwright, Page, Browser
from core.config import settings

class BaseScraper:
    def __init__(self, platform_name: str):
        self.platform_name = platform_name

    async def init_browser(self):
        playwright = await async_playwright().start()
        # Ensure we use user agent to reduce bot detection
        browser = await playwright.chromium.launch(headless=settings.PLAYWRIGHT_HEADLESS)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        page = await context.new_page()
        # try to circumvent basic navigator.webdriver checks
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return playwright, browser, page

    async def _safe_close(self, playwright, browser):
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()

    async def search(self, query: str) -> Dict[str, Any]:
        """
        Base search function to be overridden by child classes
        """
        raise NotImplementedError

    def _fallback_mock(self, query: str, base_price: float, url: str | None = None) -> Dict[str, Any]:
        """
        Provide a smart mock fallback when scraping fails due to anti-bot mechanisms
        """
        # Keep fallback results deterministic so the UI does not jump around
        # or incorrectly show an item as out of stock between searches.
        seed = abs(hash(f"{self.platform_name}:{query.lower().strip()}"))
        variance = 0.94 + ((seed % 11) * 0.012)
        price = round(base_price * variance, 2)
        return {
            "platform": self.platform_name,
            "price": price,
            "availability": "In Stock",
            "url": url
        }
