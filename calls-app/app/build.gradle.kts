plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/*
 * כתובת השרת ומפתח הטלפון נכנסים לבנייה ממשתני סביבה (סודות של GitHub
 * Actions) ולא נשמרים בגיט. בנייה בלי המפתח עדיין עוברת, והאפליקציה
 * מציגה "חסר מפתח" במקום לשלוח.
 */
val callsBaseUrl = System.getenv("CALLS_BASE_URL") ?: "https://onestop-crm.vercel.app"
val callsPhoneKey = System.getenv("CALLS_PHONE_KEY") ?: ""

android {
    namespace = "il.co.onestop.calls"
    compileSdk = 35

    defaultConfig {
        applicationId = "il.co.onestop.calls"
        minSdk = 29
        targetSdk = 35
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
        buildConfigField("String", "BASE_URL", "\"$callsBaseUrl\"")
        buildConfigField("String", "PHONE_KEY", "\"$callsPhoneKey\"")
    }

    /*
     * ⚠️ חתימה קבועה ולא מפתח debug של המכונה. מפתח debug נוצר מחדש בכל
     * ריצה של Actions, ואז עדכון לא מתקין מעל הגרסה הקודמת ואלירן צריך
     * למחוק ולהתקין מחדש.
     */
    val ksPath = System.getenv("CALLS_KEYSTORE_PATH")
    signingConfigs {
        if (ksPath != null) {
            create("fixed") {
                storeFile = file(ksPath)
                storeType = "pkcs12"
                storePassword = System.getenv("CALLS_KEYSTORE_PASSWORD")
                keyAlias = "calls"
                keyPassword = System.getenv("CALLS_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (ksPath != null) signingConfigs.getByName("fixed") else signingConfigs.getByName("debug")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
