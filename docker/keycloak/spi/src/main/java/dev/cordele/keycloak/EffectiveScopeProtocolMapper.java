package dev.cordele.keycloak;

import org.keycloak.models.ClientSessionContext;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.ProtocolMapperModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.protocol.oidc.mappers.AbstractOIDCProtocolMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAccessTokenMapper;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.AccessToken;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Keycloak protocol mapper that overrides the JWT access token {@code scope} claim
 * with the value of the user attribute {@code effective_scope}.
 *
 * <p>Purpose: enforce the role × scope matrix (RBAC) defined in
 * {@code docs/architecture/shared/rbac/modelo.md} at the IdP level. Keycloak's
 * built-in optional-scope logic grants any optional scope to any user who requests
 * it; this mapper replaces the computed scope string with the user's pre-configured
 * allowed scope, making the grant independent of what the client requested.
 *
 * <p>The mapper calls {@code AccessToken.setScope()} directly, which sets the
 * {@code @JsonProperty("scope")} field on the token. This is the authoritative
 * serialization path — avoiding the Jackson duplicate-key conflict that arises
 * when a user-attribute mapper tries to override {@code scope} via
 * {@code otherClaims}.
 *
 * <p>Runs on access tokens only ({@link OIDCAccessTokenMapper}).
 */
public class EffectiveScopeProtocolMapper
        extends AbstractOIDCProtocolMapper
        implements OIDCAccessTokenMapper {

    public static final String PROVIDER_ID = "oidc-effective-scope-mapper";

    private static final List<ProviderConfigProperty> CONFIG_PROPERTIES = new ArrayList<>();

    @Override
    public String getId() {
        return PROVIDER_ID;
    }

    @Override
    public String getDisplayType() {
        return "Effective Scope Override";
    }

    @Override
    public String getDisplayCategory() {
        return TOKEN_MAPPER_CATEGORY;
    }

    @Override
    public String getHelpText() {
        return "Replaces the access token scope claim with the user attribute "
                + "'effective_scope'. Enforces the role x scope matrix at the IdP level.";
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return CONFIG_PROPERTIES;
    }

    @Override
    public AccessToken transformAccessToken(
            AccessToken token,
            ProtocolMapperModel mappingModel,
            KeycloakSession session,
            UserSessionModel userSession,
            ClientSessionContext clientSessionCtx) {

        UserModel user = userSession.getUser();
        String scopeStr = user.getFirstAttribute("effective_scope");

        if (scopeStr != null && !scopeStr.isBlank()) {
            token.setScope(scopeStr);
        }

        return token;
    }
}
