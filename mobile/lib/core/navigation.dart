import 'package:flutter/material.dart';

/// App-wide navigator key.
///
/// ★ Deep link (`gwave://metaverse?room=city`) က widget tree ရဲ့ အပြင်ဘက်ကနေ
///   ရောက်လာတယ် — အဲဒီအချိန်မှာ `BuildContext` မရှိဘူး။ ဒါကြောင့် navigator
///   ကို global key နဲ့ ကိုင်ထားရတယ်။
final GlobalKey<NavigatorState> gwNavigatorKey = GlobalKey<NavigatorState>();
