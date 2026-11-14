<?php
/**
 * WHMCS Official bKash Tokenized Checkout Callback Handler
 *
 * Verifies transaction signature, logs transaction in WHMCS,
 * applies payment via addInvoicePayment, and triggers WHM automated provisioning.
 */

require_once __DIR__ . '/../../../init.php';
require_once __DIR__ . '/../../../includes/gatewayfunctions.php';
require_once __DIR__ . '/../../../includes/invoicefunctions.php';

$gatewayModuleName = 'bkashcheckout';
$gatewayParams = getGatewayVariables($gatewayModuleName);

if (!$gatewayParams['type']) {
    die("Module Not Activated");
}

$invoiceId = isset($_REQUEST['invoiceid']) ? intval($_REQUEST['invoiceid']) : 0;
$paymentId = isset($_REQUEST['paymentID']) ? trim((string)$_REQUEST['paymentID']) : '';
$callbackStatus = isset($_REQUEST['status']) ? strtolower(trim((string)$_REQUEST['status'])) : '';
$paymentFee = 0.00;

// Validate invoice existence in WHMCS
$invoiceId = checkCbInvoiceID($invoiceId, $gatewayParams['name']);

/**
 * Perform server-to-server bKash Tokenized Checkout verification.
 */
function bkashcheckout_http_post($url, $headers, $payload) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return array('httpCode' => $httpCode, 'body' => is_array($decoded) ? $decoded : array());
}

if (empty($paymentId) || ($callbackStatus !== '' && $callbackStatus !== 'success')) {
    logTransaction($gatewayParams['name'], $_REQUEST, 'Rejected bKash Callback: Missing paymentID or non-success status');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

$baseUrl = !empty($gatewayParams['sandboxMode'])
    ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
    : 'https://tokenized.pay.bka.sh/v1.2.0-beta';

if (
    empty($gatewayParams['appKey']) ||
    empty($gatewayParams['appSecret']) ||
    empty($gatewayParams['username']) ||
    empty($gatewayParams['password'])
) {
    logTransaction($gatewayParams['name'], $_REQUEST, 'bKash Verification Failed: Missing gateway API credentials');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

// 1. Obtain fresh merchant id_token
$grantRes = bkashcheckout_http_post(
    $baseUrl . '/tokenized/checkout/token/grant',
    array(
        'Content-Type: application/json',
        'Accept: application/json',
        'username: ' . $gatewayParams['username'],
        'password: ' . $gatewayParams['password'],
    ),
    array(
        'app_key' => $gatewayParams['appKey'],
        'app_secret' => $gatewayParams['appSecret'],
    )
);

$idToken = isset($grantRes['body']['id_token']) ? trim((string)$grantRes['body']['id_token']) : '';
if (empty($idToken)) {
    logTransaction($gatewayParams['name'], array('request' => $_REQUEST, 'grant' => $grantRes), 'bKash Token Grant Failed');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

// 2. Execute / query payment authoritatively against bKash PGW (do not trust query params)
$verifyRes = bkashcheckout_http_post(
    $baseUrl . '/tokenized/checkout/execute',
    array(
        'Content-Type: application/json',
        'Accept: application/json',
        'Authorization: ' . $idToken,
        'X-APP-Key: ' . $gatewayParams['appKey'],
    ),
    array('paymentID' => $paymentId)
);

if (empty($verifyRes['body']['trxID']) || ($verifyRes['body']['transactionStatus'] ?? '') !== 'Completed') {
    $verifyRes = bkashcheckout_http_post(
        $baseUrl . '/tokenized/checkout/payment/status',
        array(
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: ' . $idToken,
            'X-APP-Key: ' . $gatewayParams['appKey'],
        ),
        array('paymentID' => $paymentId)
    );
}

$verifiedBody = $verifyRes['body'];
$verifiedTrxId = isset($verifiedBody['trxID']) ? trim((string)$verifiedBody['trxID']) : '';
$verifiedStatus = isset($verifiedBody['transactionStatus']) ? (string)$verifiedBody['transactionStatus'] : '';
$verifiedAmount = isset($verifiedBody['amount']) ? floatval($verifiedBody['amount']) : 0.0;
$verifiedCurrency = isset($verifiedBody['currency']) ? strtoupper(trim((string)$verifiedBody['currency'])) : 'BDT';

if (empty($verifiedTrxId) || $verifiedStatus !== 'Completed' || $verifiedAmount <= 0 || $verifiedCurrency !== 'BDT') {
    logTransaction($gatewayParams['name'], array('request' => $_REQUEST, 'verify' => $verifyRes), 'Unverified or Incomplete bKash Payment');
    callback3DSecureRedirect($invoiceId, false);
    exit;
}

// 3. Reconcile paid amount against WHMCS invoice balance
if (function_exists('localAPI')) {
    $invData = localAPI('GetInvoice', array('invoiceid' => $invoiceId));
    $invBalance = isset($invData['balance']) ? floatval($invData['balance']) : floatval($invData['total'] ?? 0);
    $invCurrency = isset($invData['currencycode']) ? strtoupper((string)$invData['currencycode']) : 'BDT';
    $rate = !empty($gatewayParams['exchangeRateBDT']) ? floatval($gatewayParams['exchangeRateBDT']) : 120.0;
    $expectedBdt = ($invCurrency === 'USD') ? round($invBalance * $rate, 2) : round($invBalance, 2);

    if ($verifiedAmount + 0.50 < $expectedBdt) {
        logTransaction($gatewayParams['name'], array('verified' => $verifiedBody, 'expectedBdt' => $expectedBdt), 'bKash Payment Amount Mismatch');
        callback3DSecureRedirect($invoiceId, false);
        exit;
    }

    $creditAmount = ($invCurrency === 'USD' && $rate > 0) ? round($verifiedAmount / $rate, 2) : $verifiedAmount;
} else {
    $creditAmount = $verifiedAmount;
}

checkCbTransID($verifiedTrxId);
logTransaction($gatewayParams['name'], $verifiedBody, 'Verified bKash Tokenized Payment');

addInvoicePayment(
    $invoiceId,
    $verifiedTrxId,
    $creditAmount,
    $paymentFee,
    $gatewayModuleName
);

callback3DSecureRedirect($invoiceId, true);
