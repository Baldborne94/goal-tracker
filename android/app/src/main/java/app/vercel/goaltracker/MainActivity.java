package app.vercel.goaltracker;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

// Il Sign-In Google in modalità "offline" non passa dal Credential Manager ma
// dall'API di autorizzazione di Google, che consegna il risultato tramite
// startIntentSenderForResult. Il plugin si rifiuta di partire se l'activity
// non dichiara di inoltrargli quel risultato: da qui l'interfaccia marcatore
// e l'override qui sotto.
//
// Serve perché sul dispositivo il flusso via Credential Manager fallisce con
// "[16] Account reauth failed" pur con la configurazione OAuth corretta e
// verificata (SHA-1, package, client web, consenso in produzione).
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN ||
            requestCode > GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX
        ) {
            return;
        }

        PluginHandle handle = getBridge().getPlugin("SocialLogin");
        if (handle == null) {
            return;
        }
        Plugin plugin = handle.getInstance();
        if (plugin instanceof SocialLoginPlugin) {
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    // Marcatore richiesto dal plugin: la sua presenza certifica che l'override
    // qui sopra esiste.
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
