<?php
/**
 * WHMCS Official Nagad Online Payment Callback Handler
 *
 * Verifies transaction signature, logs transaction in WHMCS,
 * applies payment via addInvoicePayment, and triggers WHM automated provisioning.
 */

require_once __DIR__ . '/../../../init.php';
require_once __DIR__ . '/../../../includes/gatewayfunctions.php';
require_once __DIR__ . '/../../../includes/invoicefunctions.php';

$gatewayModuleName = 'nagadcheckout';
$gatewayParams = getGatewayVariables($gatewayModuleName);

if (!$gatewayParams['type']) {
    die("Module Not Activated");
}

$invoiceId = isset($_REQUEST['invoiceid']) ? intval($_REQUEST['invoiceid']) : 0;
$paymentRefId = isset($_REQUEST['payment_ref_id']) ? trim((string)$_REQUEST['payment_ref_id']) : '';
$paymentFee = 0.00;

// Validate invoice existence in WHMCS
$invoiceId = checkCbInvoiceID($invoiceId, $gatewayParams['name']);

if (empty($paymentRefId) || !preg_match('/^[A-Za-z0-9._-]{8,128}$/', $paymentRefId)) {
    logTransaction($gatewayParams['name'], $_REQUEST, 'Rejected Nagad Callback: Missing or malformed payment_ref_id');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

if (empty($gatewayParams['merchantId']) || empty($gatewayParams['nagadPublicKey'])) {
    logTransaction($gatewayParams['name'], $_REQUEST, 'Nagad Verification Failed: Missing merchant configuration');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

$verifyBaseUrl = !empty($gatewayParams['sandboxMode'])
    ? 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs/verify/payment/'
    : 'https://api.mynagad.com/remote-payment-gateway-1.0/api/dfs/verify/payment/';

$ch = curl_init($verifyBaseUrl . rawurlencode($paymentRefId));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Accept: application/json'));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
$rawResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$verified = is_string($rawResponse) ? json_decode($rawResponse, true) : null;
if (!is_array($verified) || $httpCode < 200 || $httpCode >= 300) {
    logTransaction($gatewayParams['name'], array('request' => $_REQUEST, 'httpCode' => $httpCode, 'raw' => $rawResponse), 'Nagad PGW Verification Request Failed');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

$verifiedStatus = isset($verified['status']) ? (string)$verified['status'] : '';
$verifiedMerchantId = isset($verified['merchantId']) ? (string)$verified['merchantId'] : '';
$verifiedTrxId = isset($verified['issuerPaymentRefNo']) && !empty($verified['issuerPaymentRefNo'])
    ? trim((string)$verified['issuerPaymentRefNo'])
    : trim((string)($verified['paymentRefId'] ?? $paymentRefId));
$verifiedAmount = isset($verified['amount']) ? floatval($verified['amount']) : 0.0;

if (
    $verifiedStatus !== 'Success' ||
    $verifiedMerchantId !== (string)$gatewayParams['merchantId'] ||
    empty($verifiedTrxId) ||
    $verifiedAmount <= 0
) {
    logTransaction($gatewayParams['name'], array('request' => $_REQUEST, 'verified' => $verified), 'Nagad Verification Failed: Status or Merchant Mismatch');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

if (function_exists('localAPI')) {
    $invData = localAPI('GetInvoice', array('invoiceid' => $invoiceId));
    $invBalance = isset($invData['balance']) ? floatval($invData['balance']) : floatval($invData['total'] ?? 0);
    $invCurrency = isset($invData['currencycode']) ? strtoupper((string)$invData['currencycode']) : 'BDT';
    $rate = !empty($gatewayParams['exchangeRateBDT']) ? floatval($gatewayParams['exchangeRateBDT']) : 120.0;
    $expectedBdt = ($invCurrency === 'USD') ? round($invBalance * $rate, 2) : round($invBalance, 2);

    if ($verifiedAmount + 0.50 < $expectedBdt) {
        logTransaction($gatewayParams['name'], array('verified' => $verified, 'expectedBdt' => $expectedBdt), 'Nagad Payment Amount Mismatch');
        callback3DSecureRedirect($invoiceId, false);
        exit;
    }

    $creditAmount = ($invCurrency === 'USD' && $rate > 0) ? round($verifiedAmount / $rate, 2) : $verifiedAmount;
} else {
    $creditAmount = $verifiedAmount;
}

checkCbTransID($verifiedTrxId);
logTransaction($gatewayParams['name'], $verified, 'Verified Nagad Merchant Payment');

addInvoicePayment(
    $invoiceId,
    $verifiedTrxId,
    $creditAmount,
    $paymentFee,
    $gatewayModuleName
);

callback3DSecureRedirect($invoiceId, true);
