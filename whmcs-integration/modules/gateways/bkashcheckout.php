<?php
/**
 * WHMCS Official bKash Tokenized Checkout Payment Gateway Module
 *
 * Implements tokenized bKash Checkout API v1.2.0-beta.
 * Automatically marks invoice as PAID and triggers WHM to provision cPanel accounts in < 2 seconds.
 *
 * @version 1.0.0
 * @author Global Cloud Hosting Engineering
 */

if (!defined("WHMCS")) {
    die("This file cannot be accessed directly");
}

function bkashcheckout_MetaData()
{
    return array(
        'DisplayName' => 'bKash Automated Tokenized Checkout',
        'APIVersion' => '1.1',
        'DisableLocalCreditCardInput' => true,
        'TokenisedStorage' => false,
    );
}

function bkashcheckout_config()
{
    return array(
        'FriendlyName' => array(
            'Type' => 'System',
            'Value' => 'bKash Automated Merchant Checkout',
        ),
        'appKey' => array(
            'FriendlyName' => 'bKash App Key',
            'Type' => 'text',
            'Size' => '50',
            'Description' => 'Enter your bKash Merchant App Key',
        ),
        'appSecret' => array(
            'FriendlyName' => 'bKash App Secret',
            'Type' => 'password',
            'Size' => '50',
            'Description' => 'Enter your bKash Merchant App Secret',
        ),
        'username' => array(
            'FriendlyName' => 'bKash API Username',
            'Type' => 'text',
            'Size' => '30',
            'Description' => 'Merchant portal API username',
        ),
        'password' => array(
            'FriendlyName' => 'bKash API Password',
            'Type' => 'password',
            'Size' => '30',
            'Description' => 'Merchant portal API password',
        ),
        'sandboxMode' => array(
            'FriendlyName' => 'Sandbox / Test Mode',
            'Type' => 'yesno',
            'Description' => 'Tick to enable bKash Sandbox testing environment',
        ),
        'exchangeRateBDT' => array(
            'FriendlyName' => 'USD to BDT Exchange Rate',
            'Type' => 'text',
            'Size' => '10',
            'Default' => '120.00',
            'Description' => 'Multiplier if invoice currency is USD (e.g. 120)',
        ),
    );
}

function bkashcheckout_link($params)
{
    $invoiceId = $params['invoiceid'];
    $amount = $params['amount'];
    $currency = $params['currency'];
    $systemUrl = $params['systemurl'];

    // Convert USD to BDT if necessary
    $exchangeRate = !empty($params['exchangeRateBDT']) ? floatval($params['exchangeRateBDT']) : 120.0;
    $amountBDT = ($currency == 'USD') ? round($amount * $exchangeRate, 2) : round($amount, 2);

    $callbackUrl = $systemUrl . 'modules/gateways/callback/bkashcheckout.php';

    // HTML Form with Emerald Green Pay Instantly Button
    $htmlOutput = '<form method="POST" action="' . htmlspecialchars($callbackUrl) . '">';
    $htmlOutput .= '<input type="hidden" name="action" value="initiate" />';
    $htmlOutput .= '<input type="hidden" name="invoiceid" value="' . intval($invoiceId) . '" />';
    $htmlOutput .= '<input type="hidden" name="amount" value="' . htmlspecialchars($amountBDT) . '" />';
    $htmlOutput .= '<button type="submit" class="btn btn-primary btn-lg" style="background-color: #10B981 !important; border-color: #10B981 !important; color: #0B0F19 !important; font-weight: 700; padding: 12px 28px; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; cursor: pointer; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);">';
    $htmlOutput .= '<svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2zm0-10h2v8h-2z"/></svg>';
    $htmlOutput .= '<span>Pay Instantly with bKash (৳' . number_format($amountBDT, 2) . ' BDT)</span>';
    $htmlOutput .= '</button>';
    $htmlOutput .= '</form>';

    return $htmlOutput;
}
