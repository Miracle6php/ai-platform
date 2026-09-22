<?php

/*
|--------------------------------------------------------------------------
| Paystack configuration
|--------------------------------------------------------------------------
| Add these to your .env file:
|
|   PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
|   PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
|   PAYSTACK_CURRENCY=NGN
|   APP_URL=https://your-domain.com
|
| Never commit real secret keys. Use the test keys while building,
| switch to live keys only in production.
|
| NOTE: Switched from USD back to NGN -- the Paystack merchant
| account does not support USD settlement ("Currency not supported
| by merchant"). All plans and custom purchases are priced and
| charged in NGN. Prices shown to users elsewhere in the app (e.g.
| "$15 Creator plan") are USD-denominated marketing labels only --
| the ACTUAL charge that hits Paystack is the NGN amount computed
| below via USD_TO_NGN_RATE.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/env.php';

define('PAYSTACK_SECRET_KEY', getenv('PAYSTACK_SECRET_KEY') ?: '');
define('PAYSTACK_PUBLIC_KEY', getenv('PAYSTACK_PUBLIC_KEY') ?: '');
define('PAYSTACK_CURRENCY', getenv('PAYSTACK_CURRENCY') ?: 'NGN');
define('APP_BASE_URL', rtrim((string) (getenv('APP_URL') ?: ''), '/'));

if (PAYSTACK_SECRET_KEY === '') {
    error_log('[Paystack] PAYSTACK_SECRET_KEY is not set in .env');
}


/*
|--------------------------------------------------------------------------
| Credit rate
|--------------------------------------------------------------------------
| Matches the site's stated rate: 100 credits per US dollar
| ($0.01 per credit -- see the pricing section on index.html).
| This is the rate used to describe things in USD terms throughout
| the app (marketing copy, the "$15 = 1,500 credits" labels).
|--------------------------------------------------------------------------
*/

define('CREDITS_PER_USD', 100);


/*
|--------------------------------------------------------------------------
| Manual USD -> NGN conversion rate
|--------------------------------------------------------------------------
| Since the Paystack account only settles in NGN, every USD-priced
| plan and custom amount is converted to NGN using this rate before
| being sent to Paystack. This is a FIXED number you update manually
| as the real exchange rate moves -- it is not fetched live.
|--------------------------------------------------------------------------
*/

define('USD_TO_NGN_RATE', 1500);

define('CREDITS_PER_NAIRA', CREDITS_PER_USD / USD_TO_NGN_RATE);


// Custom "buy any amount" bounds, in USD (converted to NGN at charge time)
define('CUSTOM_PURCHASE_MIN_USD', 1);
define('CUSTOM_PURCHASE_MAX_USD', 1000);


/*
|--------------------------------------------------------------------------
| Fixed one-time credit plans
|--------------------------------------------------------------------------
| NOT monthly subscriptions -- each is a single one-time purchase of
| a fixed number of credits, at a fixed USD price. price_ngn is
| computed from price_usd using USD_TO_NGN_RATE above and is what
| actually gets sent to Paystack. credits is read server-side only
| when a purchase is initialized -- never accepted from the client --
| so nothing about price or credit amount can be tampered with from
| the browser.
|--------------------------------------------------------------------------
*/

define('CREDIT_PLANS', [
    'creator' => [
        'label' => 'Creator',
        'price_usd' => 15,
        'price_ngn' => 15 * USD_TO_NGN_RATE,
        'credits' => 1500
    ],
    'pro' => [
        'label' => 'Pro',
        'price_usd' => 45,
        'price_ngn' => 45 * USD_TO_NGN_RATE,
        'credits' => 4500
    ],
    'pro_creator' => [
        'label' => 'Pro Creator',
        'price_usd' => 150,
        'price_ngn' => 150 * USD_TO_NGN_RATE,
        'credits' => 15000
    ]
]);


/*
|--------------------------------------------------------------------------
| Resolve the app's base URL
|--------------------------------------------------------------------------
| Uses APP_URL from .env if set, otherwise falls back to detecting it
| from the current request (useful in local dev).
|--------------------------------------------------------------------------
*/

function app_base_url(): string
{
    if (APP_BASE_URL !== '') {
        return APP_BASE_URL;
    }

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    return $scheme . '://' . $host;
}
