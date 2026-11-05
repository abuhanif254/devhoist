<?php
/**
 * WHMCS Official Nagad Online Payment Gateway Module
 *
 * Implements Nagad Merchant PGW API.
 * Automatically marks invoice as PAID and triggers WHM to provision cPanel accounts in < 2 seconds.
 *
 * @version 1.0.0
 * @author Global Cloud Hosting Engineering
 */

if (!defined("WHMCS")) {
    die("This file cannot be accessed directly");
}

function nagadcheckout_MetaData()
{
    return array(
        'DisplayName' => 'Nagad Automated Merchant Gateway',
        'APIVersion' => '1.1',
        'DisableLocalCreditCardInput' => true,
        'TokenisedStorage' => false,
    );
}

function nagadcheckout_config()
{
    return array(
        'FriendlyName' => array(
            'Type' => 'System',
            'Value' => 'Nagad Automated Merchant Payment',
        ),
        'merchantId' => array(
            'FriendlyName' => 'Nagad Merchant ID',
            'Type' => 'text',
            'Size' => '40',
            'Description' => 'Your official Nagad Merchant ID',
        ),
        'merchantPrivateKey' => array(
            'FriendlyName' => 'Nagad Merchant Private Key',
            'Type' => 'textarea',
            'Rows' => '4',
            'Description' => 'PGW Merchant Private Key (PEM format)',
        ),
        'nagadPublicKey' => array(
            'FriendlyName' => 'Nagad PGW Public Key',
            'Type' => 'textarea',
            'Rows' => '4',
            'Description' => 'Nagad Server Public Key for signature verification',
        ),
        'sandboxMode' => array(
            'FriendlyName' => 'Sandbox / Test Mode',
            'Type' => 'yesno',
            'Description' => 'Enable Nagad Sandbox PGW testing',
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

function nagadcheckout_link($params)
{
    $invoiceId = $params['invoiceid'];
    $amount = $params['amount'];
    $currency = $params['currency'];
    $systemUrl = $params['systemurl'];

    // Convert USD to BDT if necessary
    $exchangeRate = !empty($params['exchangeRateBDT']) ? floatval($params['exchangeRateBDT']) : 120.0;
    $amountBDT = ($currency == 'USD') ? round($amount * $exchangeRate, 2) : round($amount, 2);

    $callbackUrl = $systemUrl . 'modules/gateways/callback/nagadcheckout.php';

    // HTML Form with Orange Pay Instantly with Nagad Button
    $htmlOutput = '<form method="POST" action="' . htmlspecialchars($callbackUrl) . '">';
    $htmlOutput .= '<input type="hidden" name="action" value="initiate" />';
    $htmlOutput .= '<input type="hidden" name="invoiceid" value="' . intval($invoiceId) . '" />';
    $htmlOutput .= '<input type="hidden" name="amount" value="' . htmlspecialchars($amountBDT) . '" />';
    $htmlOutput .= '<button type="submit" class="btn btn-warning btn-lg" style="background-color: #F7941D !important; border-color: #F7941D !important; color: #FFFFFF !important; font-weight: 700; padding: 12px 28px; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; cursor: pointer; box-shadow: 0 4px 15px rgba(247, 148, 29, 0.35);">';
    $htmlOutput .= '<svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    $htmlOutput .= '<span>Pay Instantly with Nagad (৳' . number_format($amountBDT, 2) . ' BDT)</span>';
    $htmlOutput .= '</button>';
    $htmlOutput .= '</form>';

    return $htmlOutput;
}
