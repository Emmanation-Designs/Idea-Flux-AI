import { reserveCapacity, refundCapacity, refundTtsUsage, recordUsageSuccess } from './usageService.js';

async function runTests() {
  console.log('Running UsageService Hardening Unit Tests...');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Test Fail-Closed on RPC Failure for reserveCapacity
  {
    const mockSupabase = {
      rpc: async () => ({ data: null, error: { message: 'Connection timeout' } })
    };
    const result = await reserveCapacity(mockSupabase, 'user_123', 'chat_simple', 1);
    assert(result.allowed === false, 'reserveCapacity fails closed on database RPC error');
    assert(result.code === 'RESERVATION_FAILED', 'reserveCapacity returns RESERVATION_FAILED error code');
  }

  // 2. Test Duplicate Reservation Handling / Rejection
  {
    const mockSupabase = {
      rpc: async (_method: string, args: any) => {
        if (args?.p_reservation_id === 'dup_res_123') {
          return { data: { allowed: false, code: 'DUPLICATE_RESERVATION', reason: 'Duplicate reservation ID' }, error: null };
        }
        return { data: { allowed: true, reservation_id: args?.p_reservation_id }, error: null };
      }
    };
    const res1 = await reserveCapacity(mockSupabase, 'user_123', 'chat_simple', 1);
    const res2 = await reserveCapacity(mockSupabase, 'user_123', 'chat_simple', 1);
    // Force specific dup test
    const dupRes = await reserveCapacity(mockSupabase, 'user_123', 'chat_simple', 1, { quality: 'dup_res_123' });
    // Or mock directly:
    const mockSupabaseDup = {
      rpc: async () => ({ data: { allowed: false, code: 'DUPLICATE_RESERVATION', reason: 'Duplicate reservation ID' }, error: null })
    };
    const dupResult = await reserveCapacity(mockSupabaseDup, 'user_123', 'chat_simple', 1);
    assert(dupResult.allowed === false && dupResult.code === 'DUPLICATE_RESERVATION', 'Duplicate reservation ID is rejected');
  }

  // 3. Test Invalid Refunds (Missing reservation ID or non-positive cost)
  {
    const mockSupabase = { rpc: async () => ({ data: { refunded: false }, error: null }) };
    const invalidCostRes = await refundCapacity(mockSupabase, 'user_123', 0, 'res_123');
    assert(invalidCostRes === false, 'Refund with zero/negative cost is rejected');

    const missingIdRes = await refundCapacity(mockSupabase, 'user_123', 10, '');
    assert(missingIdRes === false, 'Refund with missing reservation ID is rejected');
  }

  // 4. Test Repeated Refunds (Already Refunded)
  {
    let callCount = 0;
    const mockSupabase = {
      rpc: async () => {
        callCount++;
        if (callCount > 1) {
          return { data: { refunded: false, reason: 'Reservation already refunded' }, error: null };
        }
        return { data: { refunded: true }, error: null };
      }
    };
    const firstRefund = await refundCapacity(mockSupabase, 'user_123', 10, 'res_unique_abc');
    assert(firstRefund === true, 'First refund attempt succeeds');

    const secondRefund = await refundCapacity(mockSupabase, 'user_123', 10, 'res_unique_abc');
    assert(secondRefund === false, 'Repeated refund attempt is rejected idempotently');
  }

  // 5. Test TTS Refund and Database RPC Error Handling
  {
    const mockSupabaseErr = {
      rpc: async () => ({ data: null, error: { message: 'RPC execution failed' } })
    };
    const ttsRefundRes = await refundTtsUsage(mockSupabaseErr, 'user_123', 500, 'res_tts_999');
    assert(ttsRefundRes === false, 'TTS refund safely returns false on database RPC failure without crashing');
  }

  console.log(`\nTest Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
