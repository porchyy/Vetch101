mod network {
    use vetch101_lib::engine::metadata::fetch_media_details;
    use vetch101_lib::models::MediaDetails;

    #[test]
    fn test_fetch_metadata_real_url() {
        let res = fetch_media_details("https://www.youtube.com/watch?v=aqz-KE-bpKQ", None);
        assert!(res.is_ok(), "Failed to fetch metadata: {:?}", res.err());
        match res.unwrap() {
            MediaDetails::Video(meta) => {
                assert_eq!(meta.id, "aqz-KE-bpKQ");
                assert!(meta.title.contains("Big Buck Bunny"));
                assert!(meta
                    .qualities
                    .iter()
                    .any(|q| q.id == "audio" && q.ext == "mp3"));
                assert!(meta.qualities.iter().any(|q| q.ext == "mp4"));
            }
            MediaDetails::PhotoAlbum(_) => panic!("Expected Video, got PhotoAlbum"),
        }
    }
}
