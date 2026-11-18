<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    <#if section = "header">
        <div class="wsb-header">
            <div class="wsb-badge">💧 Water Smart Bill • ระบบประปา อบต.</div>
            <h1 class="wsb-title">${msg("loginAccountTitle")}</h1>
            <p class="wsb-subtitle">เข้าสู่ระบบสำหรับเจ้าหน้าที่ อบต. และผู้ดูแลระบบ</p>
        </div>
    <#elseif section = "form">
        <div id="kc-form" class="wsb-card">
            <div id="kc-form-wrapper">
                <#if realm.password>
                    <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                        <div class="wsb-field">
                            <label for="username" class="wsb-label">ชื่อผู้ใช้งาน (Username)</label>
                            <input tabindex="1" id="username" class="wsb-input" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="off" />
                        </div>
                        <div class="wsb-field">
                            <label for="password" class="wsb-label">รหัสผ่าน (Password)</label>
                            <input tabindex="2" id="password" class="wsb-input" name="password" type="password" autocomplete="off" />
                        </div>
                        <div id="kc-form-buttons" class="wsb-actions">
                            <input tabindex="4" class="wsb-btn-primary" name="login" id="kc-login" type="submit" value="เข้าสู่ระบบ (Sign In)"/>
                        </div>
                    </form>
                </#if>
            </div>
        </div>
    </#if>
</@layout.registrationLayout>
