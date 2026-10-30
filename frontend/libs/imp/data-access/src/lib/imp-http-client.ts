/**
 * ImpHttpClient — module-scoped HTTP client for @cordele/imp.
 *
 * Extends AccessHttpClient from @cordele/shared/access-http-base.
 * X-Empresa-Id is injected automatically by AccessHttpClient on every request.
 *
 * NEVER use HttpClient directly in any imp-data-access adapter — RULE-NX-05.
 * This client is the ONLY legal HTTP entry point for the IMP module (INT-FE-IMP-001).
 */
import { Injectable } from '@angular/core';
import { AccessHttpClient } from '@cordele/shared/access-http-base';

@Injectable({ providedIn: 'root' })
export class ImpHttpClient extends AccessHttpClient {}
