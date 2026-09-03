package co.uk.adastranetwork.linq;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android's WebView ignores the page's user-scalable=no / maximum-scale viewport
        // meta (Chromium always allows pinch-zoom there for accessibility), unlike iOS —
        // so without this, pinch-zooming could pan past horizontally-clipped content.
        // Disabled natively here; vertical scrolling is unaffected.
        getBridge().getWebView().getSettings().setSupportZoom(false);
        getBridge().getWebView().getSettings().setBuiltInZoomControls(false);
        getBridge().getWebView().getSettings().setDisplayZoomControls(false);
    }
}
