describe('Gimi Mobile App Startup Verification', () => {
    it('should launch the app successfully without crashing', async () => {
        // Wait for 5 seconds to ensure app fully launches
        await driver.pause(5000);

        // Get the current package name running on the device to prove the app launched
        const currentPackage = await driver.getCurrentPackage();

        // Assert the correct package is in the foreground
        expect(currentPackage).toEqual('com.traceplus.fleet');
        console.log(`✓ Application successfully launched in foreground: ${currentPackage}`);
    });
});
